/**
 * M1 Dashboard — **the app at a glance**, in v2.
 *
 * v1 led with today's kilos and the month-cycle stage, which was the right first screen
 * for a console that ran the factory. This console manages the app, and the office has a
 * weighing system for kilos. So the questions, in the order they are now asked:
 *
 *  1. **What is waiting for me?** Queue counts with the age of the oldest item — a queue
 *     of three sitting for four days is worse than twenty from this morning. Unchanged,
 *     because every one of these queues is a `pending` in somebody's app.
 *  2. **Is the app being used?** §19.3 calls app adoption and channel shift *"the two
 *     KPIs that justify the project"*, and nothing else in the factory can answer it.
 *  3. **Is the content the app is showing wrong?** Every figure on that card is a
 *     **silent** failure — a Sinhala supplier reading English, an unwritten FAQ, a banner
 *     whose window closed a fortnight ago. None of them produce an error anywhere.
 *  4. **What is broken?** Server-composed alerts, because the rule that makes something
 *     an alert is policy, not presentation.
 *
 * The v1 cards are commented out below rather than deleted, and their data is still on
 * the payload — see `DashboardSummary`. The month-cycle card in particular is one
 * telephone call away from being wanted back: `awaitingRate` is *why the app is showing a
 * supplier blanks instead of amounts*.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Info, TriangleAlert } from 'lucide-react';
import type {
  AppAdoption,
  ContentHealth,
  CreditFacility,
  DashboardAlert,
  QueueCount,
  QueueKey,
} from '@tfd/domain';
import { dashboardRepository } from '@/services/repositories/dashboardRepository';
import { qk } from '@/query/queryKeys';
import { NAVIGATION, queuesOf } from '@/layout/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { formatAge, formatCount, formatMonthKey, formatPercent, hoursSince } from '@/lib/format';

export function DashboardScreen() {
  const { t } = useTranslation();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.dashboard,
    queryFn: dashboardRepository.get,
  });

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />

      {isPending || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section aria-label={t('dashboard.queues')} className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
            {data.queues.map((queue) => (
              <QueueCard key={queue.queue} queue={queue} />
            ))}
          </section>

          <div className="grid gap-lg lg:grid-cols-3">
            <AppAdoptionCard app={data.app} />
            <ContentHealthCard content={data.content} />

            <Card>
              <CardHeader title={t('dashboard.alerts')} />
              <CardBody>
                {data.alerts.length === 0 ? (
                  <p className="text-body-small text-text-secondary">{t('dashboard.noAlerts')}</p>
                ) : (
                  <ul className="flex flex-col gap-sm">
                    {data.alerts.map((alert) => (
                      <AlertRow key={alert.id} alert={alert} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={t('dashboard.adoptionTrend')}
              description={t('dashboard.adoptionTrendHint')}
            />
            <CardBody>
              <AdoptionTrend data={data.adoptionTrend} />
            </CardBody>
          </Card>

        </>
      )}
    </>
  );
}

/* ─────────────────────────────── queue cards ─────────────────────────────── */

/**
 * The filter that narrows a shared screen back down to the card that was clicked.
 *
 * M7 answers for three queues behind one link, so `/credit?status=pending` alone would
 * open the *Advances* card onto loans and manure as well — a card reading four and a
 * screen listing eleven, which reads as a bug in the count rather than as a wider filter.
 */
const QUEUE_FACILITY: Partial<Record<QueueKey, CreditFacility>> = {
  advanceRequests: 'advance',
  loanRequests: 'loan',
  manureRequests: 'manure',
};

function QueueCard({ queue }: { queue: QueueCount }) {
  const { t } = useTranslation();

  // The nav is the single source of where a queue lives, so a card cannot link
  // somewhere the sidebar does not.
  //
  // Matched through `queuesOf` rather than against `item.queue` directly, because one row
  // may answer for several queues: M7 carries all three credit facilities behind a single
  // link. Comparing `item.queue === queue.queue` silently missed that row — an array is
  // never equal to a string — so the advances, loans and manure cards each reported
  // "no screen in this version" while their screen was in the sidebar all along.
  const target = NAVIGATION.flatMap((section) => section.items).find((item) =>
    queuesOf(item).includes(queue.queue),
  );

  const label = t(`dashboard.queue.${queue.queue}`);

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-sm">
        <p className="text-label text-text-secondary">{label}</p>
        {queue.breachingSla > 0 ? (
          <Badge tone="error">{t('dashboard.slaBreaching', { count: queue.breachingSla })}</Badge>
        ) : null}
      </div>
      <p className="numeric mt-xs text-h2 text-text-primary">{formatCount(queue.pending)}</p>
      <p className="mt-xxs text-caption text-text-secondary">
        {queue.oldestPendingAt
          ? t('dashboard.oldestWaiting', { age: formatAge(hoursSince(queue.oldestPendingAt)) })
          : t('dashboard.queueEmpty')}
      </p>
    </>
  );

  /**
   * A queue the API reports and this console has no module for.
   *
   * It used to be the *planned* case, and now it is a forward-compatibility one: the server
   * decides which queues exist, so a newer API can name one this build has never heard of.
   * The count is still worth showing — it is a real backlog — but a card that linked
   * somewhere would be a dead link.
   */
  if (!target) {
    return (
      <Card className="opacity-70">
        <CardBody>
          {body}
          <Badge tone="neutral" className="mt-sm">
            {t('dashboard.noScreenForQueue')}
          </Badge>
        </CardBody>
      </Card>
    );
  }

  const search = new URLSearchParams({ status: 'pending' });
  const facility = QUEUE_FACILITY[queue.queue];
  if (facility) search.set('facility', facility);

  return (
    <Link
      to={`${target.to}?${search}`}
      className="rounded-lg border border-border bg-surface p-lg hover:bg-surface-variant"
    >
      {body}
      <span className="mt-sm inline-flex items-center gap-xxs text-caption text-primary">
        {label} <ArrowRight className="size-icon-xs" aria-hidden />
      </span>
    </Link>
  );
}

/* ────────────────────────── v2: adoption & content ────────────────────────── */

/**
 * How much of the supplier base is on the app.
 *
 * The share is the headline and the two counts under it are the working, in the order
 * somebody would act on them: **who has not installed it** is field work at the counter,
 * and **how many are still asking at the counter** is a trust problem no amount of
 * installing fixes.
 *
 * `appRequestShare` is `null` when nothing was raised this month, and it renders as an em
 * dash rather than `0%` — a month with no requests has no adoption share, and printing a
 * zero would report a collapse that did not happen (BR-102).
 */
function AppAdoptionCard({ app }: { app: AppAdoption }) {
  const { t } = useTranslation();

  const installed = app.totalSuppliers > 0 ? app.suppliersWithApp / app.totalSuppliers : null;
  const withoutApp = Math.max(0, app.totalSuppliers - app.suppliersWithApp);

  return (
    <Card>
      <CardHeader title={t('dashboard.appAdoption')} description={t('dashboard.appAdoptionHint')} />
      <CardBody className="flex flex-col gap-xs">
        <p className="numeric text-h2 text-text-primary">{formatPercent(installed)}</p>
        <p className="text-body-small text-text-secondary">
          {t('dashboard.appInstalled', {
            withApp: formatCount(app.suppliersWithApp),
            total: formatCount(app.totalSuppliers),
          })}
        </p>

        {/* The number to act on, and a link to the people it is about. */}
        {withoutApp > 0 ? (
          <Link
            to="/suppliers?hasApp=false"
            className="text-body-small text-primary underline-offset-2 hover:underline"
          >
            {t('dashboard.appWithout', { count: withoutApp })}
          </Link>
        ) : null}

        <p className="text-caption text-text-secondary">
          {t('dashboard.appDevices', { count: app.devicesRegistered })}
        </p>

        <p className="numeric text-body-small text-text-secondary">
          {t('dashboard.appRequestShare', { value: formatPercent(app.appRequestShare) })}
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * What the app is showing that nobody has been told about.
 *
 * Every row here is a failure with **no error attached to it**: the app renders a fallback
 * translation happily, draws its own bundled FAQ happily, and simply stops showing an
 * expired banner. The only way any of it surfaces is a screen that goes looking, which is
 * AC-08's argument about editor-visible gaps applied one level up.
 *
 * A clean state says so in words rather than showing three zeroes — a row of zeroes reads
 * as "not implemented", which is exactly what this card is here to stop being true.
 */
function ContentHealthCard({ content }: { content: ContentHealth }) {
  const { t } = useTranslation();

  const rows = [
    {
      key: 'articlesWithGaps' as const,
      count: content.articlesWithGaps,
      to: '/news?lens=incomplete',
      tone: 'text-warning',
    },
    {
      key: 'bannersExpired' as const,
      count: content.bannersExpired,
      to: '/banners?lens=expired',
      tone: 'text-text-secondary',
    },
    {
      key: 'staticPagesUnwritten' as const,
      count: content.staticPagesUnwritten,
      to: '/content',
      tone: 'text-warning',
    },
  ].filter((row) => row.count > 0);

  return (
    <Card>
      <CardHeader
        title={t('dashboard.contentHealth')}
        description={t('dashboard.contentHealthHint')}
      />
      <CardBody className="flex flex-col gap-sm">
        <p className="numeric text-h2 text-text-primary">{formatCount(content.bannersLive)}</p>
        <p className="text-body-small text-text-secondary">{t('dashboard.bannersLive')}</p>

        {rows.length === 0 ? (
          <p className="text-body-small text-success">{t('dashboard.contentClean')}</p>
        ) : (
          <ul className="flex flex-col gap-xxs">
            {rows.map((row) => (
              <li key={row.key} className={`text-body-small ${row.tone}`}>
                <Link to={row.to} className="underline decoration-border hover:decoration-primary">
                  {t(`dashboard.content.${row.key}`, { count: row.count })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ──────────────────────────────── alerts ──────────────────────────────── */

const ALERT_ICONS = { info: Info, warning: TriangleAlert, error: TriangleAlert } as const;
const ALERT_TONES = { info: 'text-info', warning: 'text-warning', error: 'text-error' } as const;

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const { t } = useTranslation();
  const Icon = ALERT_ICONS[alert.severity];

  // The server sends a key and its parameters, never a sentence — so the copy
  // stays in the console's string table and can be localized later (BR-110).
  const message = t(alert.messageKey, alert.params);

  return (
    <li className="flex items-start gap-sm">
      <Icon className={`size-icon-md shrink-0 ${ALERT_TONES[alert.severity]}`} aria-hidden />
      <span className="min-w-0 text-body-small text-text-primary">
        {alert.href ? (
          <Link to={alert.href} className="underline decoration-border hover:decoration-primary">
            {message}
          </Link>
        ) : (
          message
        )}
      </span>
    </li>
  );
}

/**
 * Twelve months of app-request share.
 *
 * Monthly rather than v1's fourteen days, and that is not a cosmetic swap: adoption moves
 * when the office hands out passwords at the counter, which is a campaign rather than a
 * day's weather. A daily line would be noise around a number that changes quarterly.
 *
 * `connectNulls={false}` is the load-bearing prop. A month with no requests at all carries
 * `null`, and joining across it would draw a straight line through a month that has no
 * answer — reporting a trend the records do not contain (BR-102, as a chart).
 */
function AdoptionTrend({ data }: { data: Array<{ monthKey: string; appShare: number | null }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {/* Through CSS variables, so the chart rebrands with everything else. */}
          <defs>
            <linearGradient id="adoption" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-divider)" vertical={false} />
          <XAxis
            dataKey="monthKey"
            tickFormatter={(value: string) => String(value).slice(5)}
            stroke="var(--color-text-secondary)"
            tickLine={false}
            fontSize={12}
          />
          <YAxis
            stroke="var(--color-text-secondary)"
            tickLine={false}
            axisLine={false}
            width={56}
            fontSize={12}
            domain={[0, 1]}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
          />
          <Tooltip
            formatter={(value) => formatPercent(value == null ? null : Number(value))}
            labelFormatter={(label) => formatMonthKey(String(label))}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-caption)',
            }}
          />
          <Area
            type="monotone"
            dataKey="appShare"
            connectNulls={false}
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#adoption)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-lg">
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-lg lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
