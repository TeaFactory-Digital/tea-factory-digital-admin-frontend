/**
 * M16 Reports, in v2: **app use over time**, the one report left.
 *
 * It answers one question an office manager asks: *are suppliers moving from the counter
 * to the app?* So the screen leads with the answer for the chosen period (four figures),
 * then shows the trend month by month (a chart), then the numbers behind it (a table that
 * can be downloaded). The earlier version was a generic report runner: a rail with one
 * entry, a citation of the spec paragraph, a row counter and columns named after database
 * fields, and the people reading it could not tell what any of it meant.
 *
 * The API returns every month and ignores a date range, so the range is applied here.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, Download, Smartphone, Sigma, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { InfoTip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/cn';
import { formatCount, formatMonthKey, formatPercent } from '@/lib/format';
import type { AppUseMonth } from '@/services/repositories/reportRepository';
import { useAppUse } from './hooks';

const RANGES = [3, 6, 12, 0] as const; // 0 = every month
type Range = (typeof RANGES)[number];

export function ReportsScreen() {
  const { t } = useTranslation();
  const query = useAppUse();
  const [range, setRange] = useState<Range>(6);

  const months = useMemo(() => {
    const all = query.data ?? [];
    return range === 0 ? all : all.slice(-range);
  }, [query.data, range]);

  const totals = useMemo(() => {
    const fromApp = months.reduce((sum, m) => sum + m.fromApp, 0);
    const fromOffice = months.reduce((sum, m) => sum + m.fromOffice, 0);
    const total = fromApp + fromOffice;
    return { fromApp, fromOffice, total, share: total > 0 ? fromApp / total : null };
  }, [months]);

  return (
    <>
      <PageHeader title={t('reports.appUse.title')} description={t('reports.appUse.subtitle')} />

      <div className="flex flex-wrap items-center justify-between gap-sm">
        {/* The period, as presets: nobody picks "from" and "to" months to ask "lately". */}
        <div
          role="group"
          aria-label={t('reports.appUse.period')}
          className="inline-flex rounded-md border border-border bg-surface p-xxs"
        >
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={cn(
                'rounded-sm px-md py-xs text-body-small transition-colors',
                range === value
                  ? 'bg-primary font-semibold text-primary-contrast'
                  : 'text-text-primary hover:bg-surface-variant',
              )}
            >
              {value === 0
                ? t('reports.appUse.allMonths')
                : t('reports.appUse.lastMonths', { count: value })}
            </button>
          ))}
        </div>

        <InfoTip label={t('reports.appUse.whatCounts')} text={t('reports.appUse.whatCounts')}>
          {t('reports.appUse.whatCountsBody')}
        </InfoTip>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-lg">
          <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : months.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title={t('reports.appUse.empty')} body={t('reports.appUse.emptyHint')} />
          </CardBody>
        </Card>
      ) : (
        <>
          <section
            aria-label={t('reports.appUse.summary')}
            className="grid gap-md sm:grid-cols-2 xl:grid-cols-4"
          >
            <Tile
              icon={TrendingUp}
              label={t('reports.appUse.share')}
              value={formatPercent(totals.share)}
              hint={t('reports.appUse.shareHint')}
              tone="primary"
            />
            <Tile
              icon={Smartphone}
              label={t('reports.appUse.fromApp')}
              value={formatCount(totals.fromApp)}
              hint={t('reports.appUse.fromAppHint')}
            />
            <Tile
              icon={Building2}
              label={t('reports.appUse.fromOffice')}
              value={formatCount(totals.fromOffice)}
              hint={t('reports.appUse.fromOfficeHint')}
            />
            <Tile
              icon={Sigma}
              label={t('reports.appUse.total')}
              value={formatCount(totals.total)}
              hint={t('reports.appUse.totalHint')}
            />
          </section>

          <Card>
            <CardHeader
              title={t('reports.appUse.chartTitle')}
              description={t('reports.appUse.chartHint')}
            />
            <CardBody>
              <MonthsChart months={months} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('reports.appUse.tableTitle')}
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<Download className="size-icon-sm" aria-hidden />}
                  onClick={() => downloadCsv(months, t)}
                >
                  {t('reports.appUse.download')}
                </Button>
              }
            />
            <MonthsTable months={months} totals={totals} />
          </Card>
        </>
      )}
    </>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: typeof Smartphone;
  label: string;
  value: string;
  hint: string;
  tone?: 'primary' | 'neutral';
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-sm">
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            tone === 'primary'
              ? 'bg-primary text-primary-contrast'
              : 'bg-primary-muted text-primary',
          )}
        >
          <Icon className="size-icon-sm" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-caption text-text-secondary">{label}</span>
          <span className="numeric text-h3 text-text-primary">{value}</span>
          <span className="text-caption text-text-secondary">{hint}</span>
        </span>
      </CardBody>
    </Card>
  );
}

/** Requests per month, app and office stacked, so the app's slice can be seen growing. */
function MonthsChart({ months }: { months: AppUseMonth[] }) {
  const { t } = useTranslation();
  const data = months.map((m) => ({
    month: formatMonthKey(m.monthKey),
    app: m.fromApp,
    office: m.fromOffice,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-divider)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--color-text-secondary)"
            tickLine={false}
            fontSize={12}
          />
          <YAxis
            stroke="var(--color-text-secondary)"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
            fontSize={12}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-variant)' }}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-caption)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="app"
            name={t('reports.appUse.fromApp')}
            stackId="requests"
            fill="var(--color-primary)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="office"
            name={t('reports.appUse.fromOffice')}
            stackId="requests"
            fill="var(--color-border)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthsTable({
  months,
  totals,
}: {
  months: AppUseMonth[];
  totals: { fromApp: number; fromOffice: number; total: number; share: number | null };
}) {
  const { t } = useTranslation();
  const headers = [
    t('reports.appUse.month'),
    t('reports.appUse.fromApp'),
    t('reports.appUse.fromOffice'),
    t('reports.appUse.total'),
    t('reports.appUse.share'),
  ];
  // Newest first in the table: the month just gone is the one people look up.
  const rows = [...months].reverse();
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-data-cell"
        aria-label={t('reports.appUse.tableTitle')}
      >
        <thead className="bg-table-header">
          <tr>
            {headers.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-md py-sm text-data-header text-text-secondary',
                  index === 0 ? 'text-left' : 'text-right',
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m, index) => (
            <tr
              key={m.monthKey}
              className={cn('border-b border-divider', index % 2 === 1 && 'bg-table-row-alt')}
            >
              <td className="px-md py-sm text-text-primary">{formatMonthKey(m.monthKey)}</td>
              <td className="numeric px-md py-sm text-right">{formatCount(m.fromApp)}</td>
              <td className="numeric px-md py-sm text-right">{formatCount(m.fromOffice)}</td>
              <td className="numeric px-md py-sm text-right">{formatCount(m.total)}</td>
              <td className="numeric px-md py-sm text-right">
                {m.appShare === null ? '—' : formatPercent(m.appShare)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="px-md py-sm text-text-primary">{t('reports.appUse.periodTotal')}</td>
            <td className="numeric px-md py-sm text-right">{formatCount(totals.fromApp)}</td>
            <td className="numeric px-md py-sm text-right">{formatCount(totals.fromOffice)}</td>
            <td className="numeric px-md py-sm text-right">{formatCount(totals.total)}</td>
            {/* The overall share, from the totals: an average of monthly percentages would
                weigh a quiet month the same as a busy one. */}
            <td className="numeric px-md py-sm text-right">{formatPercent(totals.share)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** The table as a CSV file, the same columns and the same months as on screen. */
function downloadCsv(months: AppUseMonth[], t: (key: string) => string) {
  const header = [
    t('reports.appUse.month'),
    t('reports.appUse.fromApp'),
    t('reports.appUse.fromOffice'),
    t('reports.appUse.total'),
    t('reports.appUse.share'),
  ];
  const lines = months.map((m) => [
    m.monthKey,
    m.fromApp,
    m.fromOffice,
    m.total,
    m.appShare === null ? '' : (m.appShare * 100).toFixed(1),
  ]);
  const quote = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [header, ...lines].map((line) => line.map(quote).join(',')).join('\r\n');
  // A byte-order mark, so Excel reads Sinhala and Tamil headers as UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `app-use-${months[0]?.monthKey ?? ''}-to-${months.at(-1)?.monthKey ?? ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
