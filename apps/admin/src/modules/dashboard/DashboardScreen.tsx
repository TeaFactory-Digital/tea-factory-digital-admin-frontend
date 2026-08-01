/**
 * M1 Dashboard — the day at a glance.
 *
 * What it answers, in the order the office asks:
 *
 *  1. **What is waiting for me?** Queue counts, with the age of the oldest item —
 *     because a queue of three that has been sitting for four days is worse than
 *     a queue of twenty from this morning.
 *  2. **Where is the month?** The §13 cycle stage decides what every other module
 *     will let you do, and "no rate yet" is why the app is showing blanks.
 *  3. **How much leaf came in?** Today against yesterday, and a fortnight of
 *     trend so the number means something.
 *  4. **What is broken?** Server-composed alerts, because the rule that makes
 *     something an alert is policy, not presentation.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Info, TriangleAlert } from 'lucide-react';
import type { DashboardAlert, MonthCycleStatus, QueueCount } from '@tfd/domain';
import { dashboardRepository } from '@/services/repositories/dashboardRepository';
import { qk } from '@/query/queryKeys';
import { NAVIGATION } from '@/layout/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { formatAge, formatCount, formatDate, formatKg, formatMonthKey, hoursSince } from '@/lib/format';

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
            <MonthCycleCard cycle={data.cycle} />

            <Card>
              <CardHeader title={t('dashboard.todaysCollection')} />
              <CardBody className="flex flex-col gap-xs">
                <p className="numeric text-h2 text-text-primary">{formatKg(data.today.totalKgs)}</p>
                <p className="text-body-small text-text-secondary">
                  {t('dashboard.todaysSuppliers', { count: data.today.supplierCount })} ·{' '}
                  {t('dashboard.todaysDeliveries', { count: data.today.deliveryCount })}
                </p>
                <DeltaLine today={data.today.totalKgs} yesterday={data.today.previousDayKgs} />
                <p className="text-caption text-text-secondary">{formatDate(data.today.date)}</p>
              </CardBody>
            </Card>

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
            <CardHeader title={t('dashboard.intakeTrend')} />
            <CardBody>
              <IntakeTrend data={data.intakeTrend} />
            </CardBody>
          </Card>
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

/* ────────────────────────────── month cycle ────────────────────────────── */

function MonthCycleCard({ cycle }: { cycle: MonthCycleStatus }) {
  const { t } = useTranslation();

  const tone =
    cycle.stage === 'published' ? 'success' : cycle.openExceptions > 0 ? 'warning' : 'info';

  return (
    <Card>
      <CardHeader title={t('dashboard.monthCycle')} description={formatMonthKey(cycle.monthKey)} />
      <CardBody className="flex flex-col gap-sm">
        <Badge tone={tone}>{t(`month.stage.${cycle.stage}`)}</Badge>

        {/* The stage hint exists because "awaiting rate" is the reason the app is
            showing blanks instead of amounts, and the office is the one who has
            to explain that to a supplier on the telephone. */}
        {cycle.stage === 'awaitingRate' ? (
          <p className="text-body-small text-text-secondary">
            {t('dashboard.stageHint.awaitingRate', { month: formatMonthKey(cycle.monthKey) })}
          </p>
        ) : null}
        {cycle.stage === 'published' && cycle.publishedAt ? (
          <p className="text-body-small text-text-secondary">
            {t('dashboard.stageHint.published', {
              date: formatDate(cycle.publishedAt),
              name: cycle.publishedByName ?? '',
            })}
          </p>
        ) : null}

        <p
          className={
            cycle.openExceptions > 0
              ? 'text-body-small font-semibold text-warning'
              : 'text-body-small text-success'
          }
        >
          {cycle.openExceptions > 0
            ? t('dashboard.openExceptions', { count: cycle.openExceptions })
            : t('dashboard.noExceptions')}
        </p>
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

/* ────────────────────────────── intake trend ────────────────────────────── */

function IntakeTrend({ data }: { data: Array<{ date: string; totalKgs: number }> }) {
  const { t } = useTranslation();

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {/* Colours come through CSS variables, so the chart rebrands with
              everything else. A hardcoded hex here would be the one surface a
              factory could not re-theme. */}
          <defs>
            <linearGradient id="intake" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-divider)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => value.slice(8)}
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
            unit={` ${t('dashboard.intakeAxisKg')}`}
          />
          <Tooltip
            // Recharts types these as `unknown`-ish, so the formatters coerce
            // rather than assert. `formatKg`/`formatDate` already return an em dash
            // for anything they cannot read, which is the right answer here too.
            formatter={(value) => formatKg(Number(value))}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-caption)',
            }}
          />
          <Area
            type="monotone"
            dataKey="totalKgs"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#intake)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeltaLine({ today, yesterday }: { today: number; yesterday: number }) {
  const { t } = useTranslation();
  if (yesterday <= 0) return null;

  const delta = today - yesterday;
  const percent = Math.round((delta / yesterday) * 100);
  const tone = delta >= 0 ? 'text-success' : 'text-warning';

  return (
    <p className={`numeric text-body-small ${tone}`}>
      {t('dashboard.vsYesterday', { value: `${delta >= 0 ? '+' : ''}${percent}%` })}
    </p>
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
