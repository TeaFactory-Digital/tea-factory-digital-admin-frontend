/**
 * M1 Dashboard: **the app at a glance**, in v2.
 *
 * v1 led with today's kilos and the month-cycle stage, which was the right first screen
 * for a console that ran the factory. This console manages the app, and the office has a
 * weighing system for kilos. So the questions, in the order they are now asked:
 *
 *  1. **What is waiting for me?** Queue counts with the age of the oldest item: a queue
 *     of three sitting for four days is worse than twenty from this morning. Unchanged,
 *     because every one of these queues is a `pending` in somebody's app.
 *  2. **Is the app being used?** §19.3 calls app adoption and channel shift *"the two
 *     KPIs that justify the project"*, and nothing else in the factory can answer it.
 *  3. **Is the content the app is showing wrong?** Every figure on that card is a
 *     **silent** failure: a Sinhala supplier reading English, an unwritten FAQ, a banner
 *     whose window closed a fortnight ago. None of them produce an error anywhere.
 *  4. **What is broken?** Server-composed alerts, because the rule that makes something
 *     an alert is policy, not presentation.
 *
 * The v1 cards are gone, but **their data is still on the payload**; see
 * `DashboardSummary`. That is not an oversight: `cycle.awaitingRate` is *why the app is
 * showing a supplier blanks instead of amounts*, which is a telephone call this office
 * takes whether or not it closes the month.
 *
 * ## Layout
 *
 * Four headline tiles (waiting, on the app, requests from the app, devices), then the
 * adoption trend beside the queues as a ring, then the queue cards beside what needs
 * attention. Every figure on it is one the payload already carries: a tile without a
 * history has no sparkline rather than an invented one.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BellRing,
  CircleCheck,
  FileWarning,
  ImageOff,
  Inbox,
  Info,
  Languages,
  Megaphone,
  Send,
  Smartphone,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { FACTORY_TIME_ZONE } from '@tfd/domain';
import type {
  AppAdoption,
  ContentHealth,
  CreditFacility,
  DashboardAlert,
  QueueCount,
} from '@tfd/domain';
import { dashboardRepository } from '@/services/repositories/dashboardRepository';
import { qk } from '@/query/queryKeys';
import { useCurrentUser } from '@/auth/authStore';
import { NAVIGATION, queuesOf } from '@/layout/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { InfoTip } from '@/components/ui/Tooltip';
import { StatCard } from '@/components/charts/StatCard';
import { DeltaPill } from '@/components/charts/DeltaPill';
import { Sparkline } from '@/components/charts/Sparkline';
import { Meter } from '@/components/charts/Meter';
import { DonutChart } from '@/components/charts/DonutChart';
import { seriesColor } from '@/components/charts/palette';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { GRID, LINE_CURSOR, X_AXIS, Y_AXIS, activeDot } from '@/components/charts/rechartsTheme';
import { cn } from '@/lib/cn';
import { formatAge, formatCount, formatMonthKey, formatPercent, hoursSince } from '@/lib/format';

type Trend = Array<{ monthKey: string; appShare: number | null }>;

export function DashboardScreen() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.dashboard,
    queryFn: dashboardRepository.get,
  });

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  // The whole name: a first word alone gave "Good evening, The" for "The Manager".
  const name = user?.name.trim();

  return (
    <>
      <PageHeader
        title={
          name
            ? t(`dashboard.greeting.${partOfDay()}`, { name })
            : t('dashboard.title')
        }
        description={t('dashboard.subtitle')}
      />

      {isPending || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <KpiRow queues={data.queues} app={data.app} trend={data.adoptionTrend} />

          <div className="grid gap-lg lg:grid-cols-3">
            <AdoptionTrendCard trend={data.adoptionTrend} className="lg:col-span-2" />
            <QueueMixCard queues={data.queues} />
          </div>

          <div className="grid items-start gap-lg lg:grid-cols-3">
            <QueueSection queues={data.queues} className="lg:col-span-2" />
            <div className="flex flex-col gap-lg">
              {/* Both were "not available" placeholders while the payload carried
                  neither (G-12). The API reports them now. */}
              <ContentHealthCard content={data.content} />
              <AlertsCard alerts={data.alerts} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Morning, afternoon or evening **at the factory**, not wherever the browser is.
 *
 * The office is in Sri Lanka; a platform administrator checking in from abroad should
 * see the factory's day, the same clock every date on the console is read in (BR-104).
 */
function partOfDay(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: FACTORY_TIME_ZONE,
    }).format(now),
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/* ─────────────────────────────── headline tiles ─────────────────────────────── */

/**
 * The change in app-request share between the last two months, in percentage points.
 *
 * Only when **both** months have an answer. A month with no requests has no share, and a
 * delta measured from it would be a number the records do not contain (BR-102).
 */
function monthOnMonth(trend: Trend): number | null {
  const [previous, latest] = trend.slice(-2);
  if (!previous || !latest || previous.appShare === null || latest.appShare === null) return null;
  return Math.round((latest.appShare - previous.appShare) * 100);
}

function KpiRow({ queues, app, trend }: { queues: QueueCount[]; app: AppAdoption; trend: Trend }) {
  const { t } = useTranslation();

  const pending = queues.reduce((total, queue) => total + queue.pending, 0);
  const overdue = queues.reduce((total, queue) => total + queue.breachingSla, 0);
  const installed = app.totalSuppliers > 0 ? app.suppliersWithApp / app.totalSuppliers : null;
  const withoutApp = Math.max(0, app.totalSuppliers - app.suppliersWithApp);
  const delta = monthOnMonth(trend);

  return (
    <div className="grid gap-lg sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Inbox}
        label={t('dashboard.kpi.waiting')}
        period={t('dashboard.kpi.now')}
        value={formatCount(pending)}
        delta={
          pending === 0 ? null : overdue > 0 ? (
            <Badge tone="error">{t('dashboard.kpi.overdue', { count: overdue })}</Badge>
          ) : (
            <Badge tone="success">{t('dashboard.kpi.onTarget')}</Badge>
          )
        }
        caption={pending === 0 ? t('dashboard.queueEmpty') : null}
      />

      {/* The share is the headline and the count under it is the working; **who has not
          installed it** is field work at the counter, so it links to the people it is about. */}
      <StatCard
        icon={Smartphone}
        label={
          <TitleWithTip title={t('dashboard.appAdoption')} tip={t('dashboard.appAdoptionHint')} />
        }
        value={formatPercent(installed)}
        caption={t('dashboard.appInstalled', {
          withApp: formatCount(app.suppliersWithApp),
          total: formatCount(app.totalSuppliers),
        })}
        footer={
          <div className="flex flex-col gap-sm">
            {installed !== null ? (
              <Meter value={installed} label={t('dashboard.appAdoption')} />
            ) : null}
            {withoutApp > 0 ? (
              <Link
                to="/suppliers?hasApp=false"
                className="inline-flex w-fit items-center gap-xxs text-caption font-medium text-primary hover:underline"
              >
                {t('dashboard.appWithout', { count: withoutApp })}
                <ArrowRight className="size-icon-xs" aria-hidden />
              </Link>
            ) : null}
          </div>
        }
      />

      {/* `null` is "nothing raised this month", a fact to state rather than a figure that
          is "not available", so the caption says it in words. */}
      <StatCard
        icon={Send}
        label={t('dashboard.kpi.appRequests')}
        period={t('dashboard.kpi.thisMonth')}
        value={formatPercent(app.appRequestShare)}
        delta={
          app.appRequestShare !== null && delta !== null ? (
            <DeltaPill delta={delta}>
              {t('dashboard.kpi.points', { count: Math.abs(delta) })}
            </DeltaPill>
          ) : null
        }
        caption={
          app.appRequestShare === null
            ? t('dashboard.appRequestShareNone')
            : delta !== null
              ? t('dashboard.kpi.vsLastMonth')
              : t('dashboard.kpi.ofAllRequests')
        }
        trend={<Sparkline values={trend.slice(-12).map((row) => row.appShare)} domain={[0, 1]} />}
      />

      <StatCard
        icon={BellRing}
        label={t('dashboard.kpi.devices')}
        value={formatCount(app.devicesRegistered)}
        caption={t('dashboard.kpi.devicesCaption')}
      />
    </div>
  );
}

/* ─────────────────────────────── adoption trend ─────────────────────────────── */

const RANGES = ['3', '6', '12'] as const;
type Range = (typeof RANGES)[number];

/**
 * App-request share by month, with a 3/6/12-month window.
 *
 * Monthly rather than v1's fourteen days, and that is not a cosmetic swap: adoption moves
 * when the office hands out passwords at the counter, which is a campaign rather than a
 * day's weather. A daily line would be noise around a number that changes quarterly.
 */
function AdoptionTrendCard({ trend, className }: { trend: Trend; className?: string }) {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>('12');

  const known = trend.filter((row) => row.appShare !== null);
  const charted = known.length >= 2;
  const shown = useMemo(() => trend.slice(-Number(range)), [trend, range]);
  const latest = known[known.length - 1];
  const delta = monthOnMonth(trend);

  return (
    <Card className={cn('flex animate-rise flex-col', className)}>
      <CardHeader
        title={
          <TitleWithTip
            title={t('dashboard.adoptionTrend')}
            tip={t('dashboard.adoptionTrendHint')}
          />
        }
        description={
          charted && latest ? (
            <span className="mt-xs flex flex-wrap items-baseline gap-sm">
              <span className="numeric text-h3 font-semibold tracking-tight text-text-primary">
                {formatPercent(latest.appShare)}
              </span>
              {delta !== null ? (
                <DeltaPill delta={delta}>
                  {t('dashboard.kpi.points', { count: Math.abs(delta) })}
                </DeltaPill>
              ) : null}
              <span className="text-caption">{formatMonthKey(latest.monthKey)}</span>
            </span>
          ) : undefined
        }
        actions={
          charted ? (
            <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
              <TabsList aria-label={t('dashboard.trendRange')}>
                {RANGES.map((value) => (
                  <TabsTrigger key={value} value={value} className="px-sm">
                    {t('dashboard.trendMonths', { count: Number(value) })}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null
        }
      />
      <CardBody className="flex flex-1 flex-col">
        <AdoptionTrend data={shown} known={known} />
      </CardBody>
    </Card>
  );
}

/**
 * `connectNulls={false}` is the load-bearing prop. A month with no requests at all carries
 * `null`, and joining across it would draw a straight line through a month that has no
 * answer, reporting a trend the records do not contain (BR-102, as a chart).
 */
function AdoptionTrend({ data, known }: { data: Trend; known: Trend }) {
  const { t } = useTranslation();

  /**
   * A line needs two points. With one month of history the chart was an empty grid with
   * a dot in a corner, which reads as broken. Say what there is instead.
   */
  if (known.length < 2) {
    const only = known[0];
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-xs text-center">
        {only ? (
          <p className="numeric text-h2 font-semibold tracking-tight text-text-primary">
            {formatPercent(only.appShare)}
          </p>
        ) : null}
        <p className="max-w-card text-body-small text-text-secondary">
          {only
            ? t('dashboard.trendOneMonth', { month: formatMonthKey(only.monthKey) })
            : t('dashboard.trendEmpty')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-64 w-full flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {/* Through CSS variables, so the chart rebrands with everything else. */}
          <defs>
            <linearGradient id="adoption" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="monthKey"
            tickFormatter={(value: string) => shortMonth(value)}
            {...X_AXIS}
          />
          <YAxis
            {...Y_AXIS}
            width={44}
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
          />
          <Tooltip
            cursor={LINE_CURSOR}
            content={
              <ChartTooltip
                formatValue={(value) => formatPercent(value)}
                formatLabel={(label) => formatMonthKey(String(label))}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="appShare"
            name={t('dashboard.adoptionTrend')}
            connectNulls={false}
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#adoption)"
            dot={false}
            activeDot={activeDot('var(--color-primary)')}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** `2026-09` → `Sep`. The year is in the tooltip, and twelve of them do not fit. */
function shortMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/* ─────────────────────────────── queue mix ─────────────────────────────── */

/**
 * Each queue's series slot, **by key**, so a queue keeps its colour when another empties
 * and drops out of the ring. `creditRequests` (the combined count, G-12) shares the
 * advances slot because the API sends one or the other, never both.
 */
const QUEUE_SLOT: Record<string, number> = {
  changeRequests: 0,
  inquiries: 1,
  creditRequests: 2,
  advanceRequests: 2,
  loanRequests: 3,
  teaPacketRequests: 4,
  manureRequests: 5,
};

/**
 * What is waiting, split by queue.
 *
 * Not links: the queue cards below are the way into each screen, and a second set of
 * links to the same lists would only be two places to keep in step.
 */
function QueueMixCard({ queues }: { queues: QueueCount[] }) {
  const { t } = useTranslation();
  const waiting = queues
    .filter((queue) => queue.pending > 0)
    .sort((a, b) => (QUEUE_SLOT[a.queue] ?? 9) - (QUEUE_SLOT[b.queue] ?? 9));
  const total = waiting.reduce((sum, queue) => sum + queue.pending, 0);

  return (
    <Card className="flex animate-rise flex-col">
      <CardHeader title={t('dashboard.queueMix')} description={t('dashboard.kpi.now')} />
      <CardBody className="flex flex-1 flex-col justify-center">
        {total === 0 ? (
          <div className="flex flex-col items-center gap-sm py-xl text-center">
            <CircleCheck className="size-icon-xl text-success" aria-hidden />
            <p className="text-body-small text-text-secondary">{t('dashboard.queueMixEmpty')}</p>
          </div>
        ) : (
          <DonutChart
            label={t('dashboard.queueMix')}
            total={formatCount(total)}
            totalLabel={t('dashboard.queueMixTotal')}
            formatValue={formatCount}
            showShare={waiting.length > 1}
            segments={waiting.map((queue) => ({
              key: queue.queue,
              label: t(`dashboard.queue.${queue.queue}`),
              value: queue.pending,
              color: seriesColor(QUEUE_SLOT[queue.queue] ?? 9),
            }))}
          />
        )}
      </CardBody>
    </Card>
  );
}

/* ─────────────────────────────── queue cards ─────────────────────────────── */

/**
 * Worst first, and the empty queues out of the way.
 *
 * Six cards of equal weight, five of them reading 0, made the one queue with three items
 * all past target look like one-sixth of the news. So: queues with anything waiting get a
 * card, ordered by how many are past target and then by the age of the oldest; the empty
 * ones collapse into one "all clear" line, each still a link.
 */
function QueueSection({ queues, className }: { queues: QueueCount[]; className?: string }) {
  const { t } = useTranslation();

  const waiting = queues
    .filter((queue) => queue.pending > 0)
    .sort(
      (a, b) =>
        b.breachingSla - a.breachingSla ||
        (a.oldestPendingAt ?? '').localeCompare(b.oldestPendingAt ?? ''),
    );
  const clear = queues.filter((queue) => queue.pending === 0);

  return (
    <Card className={cn('animate-rise', className)}>
      <CardHeader title={t('dashboard.queues')} description={t('dashboard.queuesHint')} />
      <CardBody className="flex flex-col gap-md">
        <section aria-label={t('dashboard.queues')} className="flex flex-col gap-md">
          {waiting.length > 0 ? (
            <div className="grid gap-md sm:grid-cols-2">
              {waiting.map((queue) => (
                <QueueCard key={queue.queue} queue={queue} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-sm rounded-md bg-success-muted px-md py-sm">
              <CircleCheck className="size-icon-md shrink-0 text-success" aria-hidden />
              <p className="text-body-small text-text-primary">{t('dashboard.allQueuesClear')}</p>
            </div>
          )}

          {clear.length > 0 && waiting.length > 0 ? (
            <div className="flex flex-wrap items-center gap-xs border-t border-divider pt-md text-caption text-text-secondary">
              <CircleCheck className="size-icon-xs shrink-0 text-success" aria-hidden />
              <span>{t('dashboard.clearQueues')}</span>
              {clear.map((queue) => (
                <Badge key={queue.queue} tone="neutral">
                  {t(`dashboard.queue.${queue.queue}`)}
                </Badge>
              ))}
            </div>
          ) : null}
        </section>
      </CardBody>
    </Card>
  );
}

/**
 * The filter that narrows a shared screen back down to the card that was clicked.
 *
 * M7 answers for three queues behind one link, so `/credit?status=pending` alone would
 * open the *Advances* card onto loans and manure as well: a card reading four and a
 * screen listing eleven, which reads as a bug in the count rather than as a wider filter.
 */
const QUEUE_FACILITY: Partial<Record<QueueCount['queue'], CreditFacility>> = {
  advanceRequests: 'advance',
  loanRequests: 'loan',
  manureRequests: 'manure',
  // `creditRequests` is deliberately absent. It is the *combined* count of all three
  // facilities, so narrowing the screen to one of them would open a card reading eleven
  // onto a list showing four.
};

function QueueCard({ queue }: { queue: QueueCount }) {
  const { t } = useTranslation();

  // The nav is the single source of where a queue lives, so a card cannot link
  // somewhere the sidebar does not.
  //
  // Matched through `queuesOf` rather than against `item.queue` directly, because one row
  // may answer for several queues: M7 carries all three credit facilities behind a single
  // link. Comparing `item.queue === queue.queue` silently missed that row (an array is
  // never equal to a string), so the advances, loans and manure cards each reported
  // "no screen in this version" while their screen was in the sidebar all along.
  const target = NAVIGATION.flatMap((section) => section.items).find((item) =>
    queuesOf(item).includes(queue.queue),
  );

  const label = t(`dashboard.queue.${queue.queue}`);
  const Icon = target?.icon ?? Inbox;

  const body = (
    <>
      <div className="flex items-center justify-between gap-sm">
        <span className="flex min-w-0 items-center gap-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-variant text-text-secondary">
            <Icon className="size-icon-sm" aria-hidden />
          </span>
          <p className="truncate text-label text-text-secondary">{label}</p>
        </span>
        {queue.breachingSla > 0 ? (
          <Badge tone="error">{t('dashboard.slaBreaching', { count: queue.breachingSla })}</Badge>
        ) : null}
      </div>
      <p className="numeric mt-md text-h2 font-semibold tracking-tight text-text-primary">
        {formatCount(queue.pending)}
      </p>
      {/* `oldestPendingAt` is now reported (G-12 closed), so `null` means one thing
          again: the queue is empty. */}
      <p className="mt-sm text-caption text-text-secondary">
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
   * The count is still worth showing (it is a real backlog), but a card that linked
   * somewhere would be a dead link.
   */
  if (!target) {
    return (
      <div className="rounded-lg border border-border p-lg opacity-70">
        {body}
        <Badge tone="neutral" className="mt-sm">
          {t('dashboard.noScreenForQueue')}
        </Badge>
      </div>
    );
  }

  const search = new URLSearchParams({ status: 'pending' });
  const facility = QUEUE_FACILITY[queue.queue];
  if (facility) search.set('facility', facility);

  return (
    <Link
      to={`${target.to}?${search}`}
      className={cn(
        'group rounded-lg border p-lg transition-[background-color,box-shadow] duration-150 hover:shadow-card',
        queue.breachingSla > 0
          ? 'border-error bg-error-muted/40 hover:bg-error-muted/60'
          : 'border-border bg-surface hover:bg-surface-variant',
      )}
    >
      {body}
      <span className="mt-md inline-flex items-center gap-xxs text-caption font-medium text-primary">
        {label}
        <ArrowRight
          className="size-icon-xs transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

/* ────────────────────────── content & alerts ────────────────────────── */

/** One line of the feed: a tinted icon tile, the sentence, and where it leads. */
function FeedRow({
  icon: Icon,
  tone,
  children,
  to,
}: {
  icon: LucideIcon;
  tone: 'info' | 'warning' | 'error' | 'neutral';
  children: ReactNode;
  to?: string;
}) {
  const tile = {
    info: 'bg-info-muted text-info',
    warning: 'bg-warning-muted text-warning',
    error: 'bg-error-muted text-error',
    neutral: 'bg-surface-variant text-text-secondary',
  }[tone];

  return (
    <li className="flex items-start gap-md border-t border-divider py-sm first:border-t-0 first:pt-0">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', tile)}>
        <Icon className="size-icon-sm" aria-hidden />
      </span>
      <span className="min-w-0 pt-xs text-body-small text-text-primary">
        {to ? (
          <Link
            to={to}
            className="underline decoration-border underline-offset-2 hover:decoration-primary"
          >
            {children}
          </Link>
        ) : (
          children
        )}
      </span>
    </li>
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
 * A clean state says so in words rather than showing three zeroes: a row of zeroes reads
 * as "not implemented", which is exactly what this card is here to stop being true.
 */
function ContentHealthCard({ content }: { content: ContentHealth }) {
  const { t } = useTranslation();

  const rows = [
    {
      key: 'articlesWithGaps' as const,
      count: content.articlesWithGaps,
      to: '/news?lens=incomplete',
      icon: Languages,
      tone: 'warning' as const,
    },
    {
      key: 'bannersExpired' as const,
      count: content.bannersExpired,
      to: '/banners?lens=expired',
      icon: ImageOff,
      tone: 'neutral' as const,
    },
    {
      key: 'staticPagesUnwritten' as const,
      count: content.staticPagesUnwritten,
      to: '/content',
      icon: FileWarning,
      tone: 'warning' as const,
    },
  ].filter((row) => row.count > 0);

  return (
    <Card className="animate-rise">
      <CardHeader
        title={
          <TitleWithTip
            title={t('dashboard.contentHealth')}
            tip={t('dashboard.contentHealthHint')}
          />
        }
      />
      <CardBody className="flex flex-col gap-md">
        <div className="flex items-center gap-md rounded-md bg-surface-variant px-md py-sm">
          <Megaphone className="size-icon-md shrink-0 text-primary" aria-hidden />
          <p className="flex items-baseline gap-xs text-body-small text-text-secondary">
            <span className="numeric text-title text-text-primary">
              {formatCount(content.bannersLive)}
            </span>
            {t('dashboard.bannersLive')}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="flex items-center gap-xs text-body-small text-success">
            <CircleCheck className="size-icon-sm shrink-0" aria-hidden />
            {t('dashboard.contentClean')}
          </p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <FeedRow key={row.key} icon={row.icon} tone={row.tone} to={row.to}>
                {t(`dashboard.content.${row.key}`, { count: row.count })}
              </FeedRow>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

const ALERT_ICONS = { info: Info, warning: TriangleAlert, error: TriangleAlert } as const;

function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  const { t } = useTranslation();

  return (
    <Card className="animate-rise">
      <CardHeader title={t('dashboard.alerts')} />
      <CardBody>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-xs text-body-small text-text-secondary">
            <CircleCheck className="size-icon-sm shrink-0 text-success" aria-hidden />
            {t('dashboard.noAlerts')}
          </p>
        ) : (
          <ul className="flex flex-col">
            {alerts.map((alert) => (
              // The server sends a key and its parameters, never a sentence, so the copy
              // stays in the console's string table and can be localized later (BR-110).
              <FeedRow
                key={alert.id}
                icon={ALERT_ICONS[alert.severity]}
                tone={alert.severity}
                to={alert.href}
              >
                {t(alert.messageKey, alert.params)}
              </FeedRow>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-lg">
      <div className="grid gap-lg sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-lg lg:grid-cols-3">
        <Skeleton className="h-80 rounded-lg lg:col-span-2" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <div className="grid gap-lg lg:grid-cols-3">
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

/** A card title with its explanation behind an "i" rather than under it. */
function TitleWithTip({ title, tip }: { title: string; tip: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-xxs">
      {title}
      <InfoTip label={t('tip.moreInfo')}>{tip}</InfoTip>
    </span>
  );
}
