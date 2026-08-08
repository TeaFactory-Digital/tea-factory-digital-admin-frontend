/**
 * One supplier's months — **the screen a clerk needs while the supplier is on the
 * telephone.**
 *
 * v1 had no way to see this at all. `BillQuery` offered `monthKey` and a text search,
 * which is the accountant's axis: pick a month, then filter within it. That was right
 * when M5 fed the month close, and it is wrong now that M5 survives only as supplier
 * support — because the question support is asked is never about one month. It is
 * *"why is my July less than my June?"*, and answering it needs both at once.
 *
 * **Deliberately the same three views the app gives the supplier**
 * (`IncomeHistoryScreen`), in the same order, because the whole point is that the clerk
 * and the supplier are looking at the same thing:
 *
 *  - **Graph** — a bar per month, switchable between earnings and kilos. The switch
 *    matters: "I delivered more and got less" is a rate question, and seeing the two
 *    series separately is what makes that visible rather than arguable.
 *  - **List** — the rows, newest first, each linking to the slip.
 *  - **Chart** — where one month's money went, as a donut of its deduction lines. This
 *    is the view that answers the actual complaint most of the time: the gross was fine
 *    and something came off it.
 *
 * Two rules carried from the app rather than reinvented:
 *
 *  - **`null` is not `0`** (BR-102). A month with no auction result yet has no gross and
 *    no balance. The graph **omits** those bars in earnings mode rather than drawing
 *    them at zero, and the list shows a pending badge. A zero bar would tell a supplier
 *    they earned nothing in a month that simply has not settled.
 *  - **The months arrive oldest-first** and the list reverses them. A chart reads left
 *    to right; a list is read top-down from the most recent. Same data, two orders, and
 *    both are what the reader expects.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DeductionLines, SupplierMonthSummary } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { formatAmount, formatKg, formatMonthKey } from '@/lib/format';
import { useBill } from '@/modules/bills/hooks';
import { useSupplierIncome } from './hooks';

type ViewMode = 'graph' | 'list' | 'chart';
type Metric = 'earnings' | 'kgs';

/**
 * The nine deduction lines, in the printed account's order.
 *
 * The order is the slip's, not descending by value: an office reading a supplier their
 * deductions reads down the paper they are both holding. A chart that reordered by size
 * would be easier to read and impossible to follow along with.
 */
const DEDUCTION_KEYS: Array<keyof DeductionLines> = [
  'transportCharges',
  'tea',
  'savings',
  'loansAdvance',
  'advance',
  'manure',
  'otherCards',
  'stamps',
  'previousDebts',
];

/**
 * The donut's colours.
 *
 * Chart tokens rather than semantic ones: `--color-error` on a deduction slice would
 * say *this line is wrong*, and every one of these is a normal charge. They resolve
 * through CSS custom properties like every other colour here, so the chart rebrands
 * with the console (white-label.md → the golden rule).
 */
const SLICE_VARS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-info)',
  'var(--color-primary-muted)',
  'var(--color-warning)',
  'var(--color-text-secondary)',
  'var(--color-divider)',
  'var(--color-success)',
  'var(--color-border)',
];

export function SupplierIncomeHistory({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();

  const [view, setView] = useState<ViewMode>('graph');
  const [metric, setMetric] = useState<Metric>('earnings');
  /** `undefined` until the reader picks one — the server resolves it to the newest. */
  const [year, setYear] = useState<number | undefined>();
  const [monthKey, setMonthKey] = useState<string>('');

  const history = useSupplierIncome(supplierId, year);
  const months = useMemo(() => history.data?.months ?? [], [history.data]);

  /**
   * The month the donut is about: whichever the reader picked, else the most recent
   * that actually has a bill. `months` is oldest-first, so the last one is newest.
   */
  const chartMonth = useMemo(() => {
    const picked = months.find((one) => one.monthKey === monthKey);
    return picked ?? months.filter((one) => one.billId).at(-1) ?? null;
  }, [months, monthKey]);

  // Only fetched in the chart view — a donut nobody is looking at is a bill nobody
  // asked for, on a connection the weighing point is sharing.
  const bill = useBill(view === 'chart' ? (chartMonth?.billId ?? undefined) : undefined);

  const bars = useMemo(
    () =>
      months
        // Earnings are unknown until the auction result is in; kilos are not. Omitted
        // rather than drawn at zero — see the file docblock.
        .filter((one) => metric !== 'earnings' || one.grossAmount != null)
        .map((one) => ({
          monthKey: one.monthKey,
          value: (metric === 'earnings' ? one.grossAmount : one.totalKgs) ?? 0,
        })),
    [months, metric],
  );

  const slices = useMemo(() => {
    const lines = bill.data?.deductions;
    if (!lines) return [];
    return DEDUCTION_KEYS.map((key, index) => ({
      key,
      // M5's existing labels, not a second set: the donut and the slip must name a
      // line identically, or a clerk reading one to a supplier holding the other is
      // reading two different words for one charge.
      label: t(`bills.deduction.${key}`),
      value: lines[key],
      fill: SLICE_VARS[index % SLICE_VARS.length]!,
    })).filter((slice) => slice.value > 0);
  }, [bill.data, t]);

  if (history.error) {
    return (
      <Card>
        <CardHeader title={t('suppliers.income.title')} />
        <CardBody>
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        </CardBody>
      </Card>
    );
  }

  const years = history.data?.years ?? [];

  return (
    <Card>
      <CardHeader
        title={t('suppliers.income.title')}
        description={t('suppliers.income.subtitle')}
        actions={
          years.length > 0 ? (
            <Select
              aria-label={t('suppliers.income.year')}
              value={String(history.data?.year ?? '')}
              onChange={(event) => {
                setYear(Number(event.target.value));
                // The picked month belongs to the year that is leaving; keeping it
                // would leave the donut labelled with a month not in the series.
                setMonthKey('');
              }}
              fullWidth={false}
            >
              {years.map((one) => (
                <option key={one} value={one}>
                  {one}
                </option>
              ))}
            </Select>
          ) : null
        }
      />

      <CardBody className="flex flex-col gap-md">
        <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
          <TabsList aria-label={t('suppliers.income.views')}>
            <TabsTrigger value="graph">{t('suppliers.income.tab.graph')}</TabsTrigger>
            <TabsTrigger value="list">{t('suppliers.income.tab.list')}</TabsTrigger>
            <TabsTrigger value="chart">{t('suppliers.income.tab.chart')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {history.isPending ? (
          <Skeleton className="h-64" />
        ) : months.length === 0 ? (
          <EmptyState
            title={t('suppliers.income.empty')}
            body={t('suppliers.income.emptyHint')}
          />
        ) : view === 'graph' ? (
          <>
            <Tabs value={metric} onValueChange={(value) => setMetric(value as Metric)}>
              <TabsList aria-label={t('suppliers.income.metric')}>
                <TabsTrigger value="earnings">{t('suppliers.income.earnings')}</TabsTrigger>
                <TabsTrigger value="kgs">{t('suppliers.income.kgs')}</TabsTrigger>
              </TabsList>
            </Tabs>

            {bars.length === 0 ? (
              // Every month of the year is still awaiting its auction result. Saying so
              // beats an axis with nothing under it, which reads as a broken chart.
              <EmptyState
                title={t('suppliers.income.noEarningsYet')}
                body={t('suppliers.income.noEarningsYetHint')}
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="monthKey"
                      // Just the month number: twelve full month names do not fit, and
                      // the year is already on the picker above.
                      tickFormatter={(value: string) => String(value).slice(5)}
                      stroke="var(--color-text-secondary)"
                      tickLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      stroke="var(--color-text-secondary)"
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value) =>
                        metric === 'earnings'
                          ? formatAmount(Number(value))
                          : formatKg(Number(value))
                      }
                      labelFormatter={(label) => formatMonthKey(String(label))}
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-caption)',
                      }}
                    />
                    <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : view === 'list' ? (
          <ul className="flex flex-col divide-y divide-divider">
            {/* Newest first — a list is read from the top. The series arrives
                oldest-first because the graph above needs it that way. */}
            {[...months].reverse().map((month) => (
              <MonthRow key={month.monthKey} month={month} />
            ))}
          </ul>
        ) : (
          <>
            <Select
              aria-label={t('suppliers.income.month')}
              value={chartMonth?.monthKey ?? ''}
              onChange={(event) => setMonthKey(event.target.value)}
              fullWidth={false}
            >
              {months
                .filter((one) => one.billId)
                .map((one) => (
                  <option key={one.monthKey} value={one.monthKey}>
                    {formatMonthKey(one.monthKey)}
                  </option>
                ))}
            </Select>

            {bill.isPending ? (
              <Skeleton className="h-64" />
            ) : slices.length === 0 ? (
              <EmptyState
                title={t('suppliers.income.noDeductions')}
                body={t('suppliers.income.noDeductionsHint')}
              />
            ) : (
              <div className="grid gap-md sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="55%"
                        outerRadius="85%"
                        stroke="var(--color-surface)"
                      >
                        {slices.map((slice) => (
                          <Cell key={slice.key} fill={slice.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatAmount(Number(value))}
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--text-caption)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* The figures beside the donut, not only in a tooltip. A clerk reading
                    them aloud cannot hover, and the supplier is holding the slip. */}
                <ul className="flex flex-col justify-center gap-xxs">
                  {slices.map((slice) => (
                    <li key={slice.key} className="flex items-center gap-sm">
                      <span
                        aria-hidden
                        className="size-icon-xs shrink-0 rounded-sm"
                        style={{ background: slice.fill }}
                      />
                      <span className="flex-1 text-body-small text-text-primary">
                        {slice.label}
                      </span>
                      <span className="numeric text-body-small text-text-primary">
                        {formatAmount(slice.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function MonthRow({ month }: { month: SupplierMonthSummary }) {
  const { t } = useTranslation();

  const row = (
    <span className="flex flex-1 items-center justify-between gap-sm py-sm">
      <span className="flex flex-col">
        <span className="text-body-small font-medium text-text-primary">
          {formatMonthKey(month.monthKey)}
        </span>
        <span className="numeric text-caption text-text-secondary">
          {formatKg(month.totalKgs)}
          {month.finalBalance != null
            ? ` · ${t('suppliers.income.paid', { amount: formatAmount(month.finalBalance) })}`
            : ''}
        </span>
      </span>

      <span className="flex items-center gap-sm">
        {/**
         * The pending badge is the `null` case made legible. It is the same state the
         * app shows the supplier, and the sentence the office has to say on the
         * telephone — "the auction result is not in yet".
         */}
        {month.grossAmount == null ? (
          <Badge tone="neutral">{t('suppliers.income.pending')}</Badge>
        ) : (
          <span className="numeric text-body-small font-semibold text-text-primary">
            {formatAmount(month.grossAmount)}
          </span>
        )}
      </span>
    </span>
  );

  // A month with no bill is a month with nothing to open. Rendered as a row rather than
  // a dead link, because the row itself is the answer to "what happened in May".
  if (!month.billId) {
    return <li className="flex">{row}</li>;
  }

  return (
    <li className="flex">
      <Link
        to={`/bills/${month.billId}`}
        className="flex flex-1 rounded-md px-xs hover:bg-surface-variant"
      >
        {row}
      </Link>
    </li>
  );
}
