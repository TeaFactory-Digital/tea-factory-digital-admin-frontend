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
import type { AppAdoption, ContentHealth, DashboardAlert, QueueCount } from '@tfd/domain';
/* v1: `MonthCycleStatus`, for the month-cycle card commented out below. */
import { dashboardRepository } from '@/services/repositories/dashboardRepository';
import { qk } from '@/query/queryKeys';
import { NAVIGATION } from '@/layout/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { formatAge, formatCount, formatMonthKey, formatPercent, hoursSince } from '@/lib/format';
/* v1: `formatDate` and `formatKg`, for the collection and intake cards commented out below. */

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

          {/* ────────────────────────────────────────────────────────────────────
            * v1's factory-operations row. Commented out, not deleted — the data is
            * still on the payload (`DashboardSummary`), so bringing the month-cycle
            * card back is uncommenting these lines.
            *
            *   <MonthCycleCard cycle={data.cycle} />
            *
            *   <Card>
            *     <CardHeader title={t('dashboard.todaysCollection')} />
            *     <CardBody className="flex flex-col gap-xs">
            *       <p className="numeric text-h2 text-text-primary">{formatKg(data.today.totalKgs)}</p>
            *       <p className="text-body-small text-text-secondary">
            *         {t('dashboard.todaysSuppliers', { count: data.today.supplierCount })} ·{' '}
            *         {t('dashboard.todaysDeliveries', { count: data.today.deliveryCount })}
            *       </p>
            *       <DeltaLine today={data.today.totalKgs} yesterday={data.today.previousDayKgs} />
            *       <p className="text-caption text-text-secondary">{formatDate(data.today.date)}</p>
            *     </CardBody>
            *   </Card>
            * ──────────────────────────────────────────────────────────────────── */}

          <Card>
            <CardHeader
              title={t('dashboard.adoptionTrend')}
              description={t('dashboard.adoptionTrendHint')}
            />
            <CardBody>
              <AdoptionTrend data={data.adoptionTrend} />
            </CardBody>
          </Card>

          {/* v1's fortnight of intake, replaced by the adoption trend above:
            *
            *   <Card>
            *     <CardHeader title={t('dashboard.intakeTrend')} />
            *     <CardBody>
            *       <IntakeTrend data={data.intakeTrend} />
            *     </CardBody>
            *   </Card>
            */}
        </>
      )}
    </>
  );
}

/* ─────────────────────────────── queue cards ─────────────────────────────── */

function QueueCard({ queue }: { queue: QueueCount }) {
  const { t } = useTranslation();

  // The nav is the single source of where a queue lives, so a card cannot link
  // somewhere the sidebar does not.
  const target = NAVIGATION.flatMap((section) => section.items).find(
    (item) => item.queue === queue.queue,
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

  return (
    <Link
      to={`${target.to}?status=pending`}
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

/* ────────────────────────────── month cycle ────────────────────────────── */

// ────────────────────────────────────────────────────────────────────────────
// v1's month-cycle card. Commented out with the row that rendered it, and kept
// because it is the one v1 card most likely to be wanted back: `awaitingRate` is
// *why the app is showing a supplier blanks instead of amounts*, and that is a
// telephone call the office takes whether or not it runs the month close.
//
// `cycle` is still on `DashboardSummary`, so restoring this is uncommenting it.
// ────────────────────────────────────────────────────────────────────────────
// function MonthCycleCard({ cycle }: { cycle: MonthCycleStatus }) {
//   const { t } = useTranslation();
//
//   const tone =
//     cycle.stage === 'published' ? 'success' : cycle.openExceptions > 0 ? 'warning' : 'info';
//
//   return (
//     <Card>
//       <CardHeader title={t('dashboard.monthCycle')} description={formatMonthKey(cycle.monthKey)} />
//       <CardBody className="flex flex-col gap-sm">
//         <Badge tone={tone}>{t(`month.stage.${cycle.stage}`)}</Badge>
//
//         {/* The stage hint exists because "awaiting rate" is the reason the app is
//             showing blanks instead of amounts, and the office is the one who has
//             to explain that to a supplier on the telephone. */}
//         {cycle.stage === 'awaitingRate' ? (
//           <p className="text-body-small text-text-secondary">
//             {t('dashboard.stageHint.awaitingRate', { month: formatMonthKey(cycle.monthKey) })}
//           </p>
//         ) : null}
//         {cycle.stage === 'published' && cycle.publishedAt ? (
//           <p className="text-body-small text-text-secondary">
//             {t('dashboard.stageHint.published', {
//               date: formatDate(cycle.publishedAt),
//               name: cycle.publishedByName ?? '',
//             })}
//           </p>
//         ) : null}
//
//         <p
//           className={
//             cycle.openExceptions > 0
//               ? 'text-body-small font-semibold text-warning'
//               : 'text-body-small text-success'
//           }
//         >
//           {cycle.openExceptions > 0
//             ? t('dashboard.openExceptions', { count: cycle.openExceptions })
//             : t('dashboard.noExceptions')}
//         </p>
//       </CardBody>
//     </Card>
//   );
// }

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

/* ────────────────────────────── intake trend ────────────────────────────── */

// ────────────────────────────────────────────────────────────────────────────
// v1's fortnight of intake, replaced by `AdoptionTrend`. `intakeTrend` is still on
// the payload; the leaf itself is the factory's own console's.
// ────────────────────────────────────────────────────────────────────────────
// function IntakeTrend({ data }: { data: Array<{ date: string; totalKgs: number }> }) {
//   const { t } = useTranslation();
//
//   return (
//     <div className="h-64 w-full">
//       <ResponsiveContainer width="100%" height="100%">
//         <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
//           {/* Colours come through CSS variables, so the chart rebrands with
//               everything else. A hardcoded hex here would be the one surface a
//               factory could not re-theme. */}
//           <defs>
//             <linearGradient id="intake" x1="0" y1="0" x2="0" y2="1">
//               <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
//               <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
//             </linearGradient>
//           </defs>
//           <CartesianGrid stroke="var(--color-divider)" vertical={false} />
//           <XAxis
//             dataKey="date"
//             tickFormatter={(value: string) => value.slice(8)}
//             stroke="var(--color-text-secondary)"
//             tickLine={false}
//             fontSize={12}
//           />
//           <YAxis
//             stroke="var(--color-text-secondary)"
//             tickLine={false}
//             axisLine={false}
//             width={56}
//             fontSize={12}
//             unit={` ${t('dashboard.intakeAxisKg')}`}
//           />
//           <Tooltip
//             // Recharts types these as `unknown`-ish, so the formatters coerce
//             // rather than assert. `formatKg`/`formatDate` already return an em dash
//             // for anything they cannot read, which is the right answer here too.
//             formatter={(value) => formatKg(Number(value))}
//             labelFormatter={(label) => formatDate(String(label))}
//             contentStyle={{
//               background: 'var(--color-surface)',
//               border: '1px solid var(--color-border)',
//               borderRadius: 'var(--radius-md)',
//               fontSize: 'var(--text-caption)',
//             }}
//           />
//           <Area
//             type="monotone"
//             dataKey="totalKgs"
//             stroke="var(--color-primary)"
//             strokeWidth={2}
//             fill="url(#intake)"
//           />
//         </AreaChart>
//       </ResponsiveContainer>
//     </div>
//   );
// }
//
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

// v1's today-against-yesterday line, kept for the collection card commented out above.
// function DeltaLine({ today, yesterday }: { today: number; yesterday: number }) {
//   const { t } = useTranslation();
//   if (yesterday <= 0) return null;
//
//   const delta = today - yesterday;
//   const percent = Math.round((delta / yesterday) * 100);
//   const tone = delta >= 0 ? 'text-success' : 'text-warning';
//
//   return (
//     <p className={`numeric text-body-small ${tone}`}>
//       {t('dashboard.vsYesterday', { value: `${delta >= 0 ? '+' : ''}${percent}%` })}
//     </p>
//   );
// }

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
