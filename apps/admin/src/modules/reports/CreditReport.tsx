/**
 * Credit and tea packets given, across the factory: how much went out as advances, loans
 * and manure, how many tea packets, and how many requests were refused, month by month.
 *
 * **Approved requests only, by the month they were decided.** A pending request may never
 * be paid and a rejected one never was; refusals are counted on their own.
 *
 * Until the API serves the report (BACKEND-TODO #29) it answers `404`, and the tab says
 * the report is not available yet rather than showing an error. One supplier's requests
 * are on their record (Suppliers, then Requests).
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
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { BAR_CURSOR, GRID, MAX_BAR, X_AXIS, Y_AXIS } from '@/components/charts/rechartsTheme';
import { Banknote, Coffee, Download, HandCoins, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatCount, formatMoney, formatMonthKey } from '@/lib/format';
import type { CreditMonth } from '@/services/repositories/reportRepository';
import { useCreditGiven } from './hooks';

const RANGES = [6, 12, 0] as const; // 0 = every month
type Range = (typeof RANGES)[number];

export function CreditReport() {
  const { t } = useTranslation();
  const query = useCreditGiven();
  const [range, setRange] = useState<Range>(12);

  const months = useMemo(() => {
    const all = query.data ?? [];
    return range === 0 ? all : all.slice(-range);
  }, [query.data, range]);

  const sum = (pick: (m: CreditMonth) => number) => months.reduce((total, m) => total + pick(m), 0);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-lg">
        <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === null) return <Notice tone="info">{t('reports.credit.notYet')}</Notice>;
  if (months.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title={t('reports.credit.empty')} body={t('reports.credit.emptyHint')} />
        </CardBody>
      </Card>
    );
  }

  const tiles = [
    {
      icon: Banknote,
      label: t('reports.credit.advances'),
      amount: sum((m) => m.advanceAmount),
      count: sum((m) => m.advanceCount),
    },
    {
      icon: HandCoins,
      label: t('reports.credit.loans'),
      amount: sum((m) => m.loanAmount),
      count: sum((m) => m.loanCount),
    },
    {
      icon: Leaf,
      label: t('reports.credit.manure'),
      amount: sum((m) => m.manureAmount),
      count: sum((m) => m.manureCount),
    },
  ];

  return (
    <>
      <div
        role="group"
        aria-label={t('reports.appUse.period')}
        className="inline-flex gap-xxs self-start rounded-md border border-border bg-surface p-xxs shadow-card"
      >
        {RANGES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => setRange(value)}
            className={cn(
              'rounded-sm px-md py-xs text-body-small transition-colors duration-150',
              range === value
                ? 'bg-primary-muted font-semibold text-text-primary ring-1 ring-primary/30 ring-inset'
                : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary',
            )}
          >
            {value === 0
              ? t('reports.appUse.allMonths')
              : t('reports.appUse.lastMonths', { count: value })}
          </button>
        ))}
      </div>

      <section
        aria-label={t('reports.appUse.summary')}
        className="grid gap-md sm:grid-cols-2 xl:grid-cols-4"
      >
        {tiles.map((tile) => (
          <Tile
            key={tile.label}
            icon={tile.icon}
            label={tile.label}
            value={formatMoney(tile.amount)}
            hint={t('reports.credit.approvedCount', { count: tile.count })}
          />
        ))}
        <Tile
          icon={Coffee}
          label={t('reports.credit.teaPackets')}
          value={formatCount(sum((m) => m.teaPackets))}
          hint={formatMoney(sum((m) => m.teaPacketAmount))}
        />
      </section>

      <Card>
        <CardHeader
          title={t('reports.appUse.chartTitle')}
          description={t('reports.credit.chartHint')}
        />
        <CardBody>
          <MonthsChart months={months} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('reports.appUse.tableTitle')}
          description={t('reports.credit.rejectedTotal', { count: sum((m) => m.rejected) })}
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
        <MonthsTable months={months} />
      </Card>
    </>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-sm">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary"
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

/** Advances, loans and manure given each month, stacked, so the month's total is the bar. */
function MonthsChart({ months }: { months: CreditMonth[] }) {
  const { t } = useTranslation();
  const data = months.map((m) => ({
    month: formatMonthKey(m.monthKey),
    advance: m.advanceAmount,
    loan: m.loanAmount,
    manure: m.manureAmount,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" {...X_AXIS} />
          <YAxis {...Y_AXIS} width={64} />
          <Tooltip
            cursor={BAR_CURSOR}
            content={<ChartTooltip formatValue={(value) => formatMoney(value)} />}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span className="text-text-secondary">{value}</span>}
          />
          <Bar
            maxBarSize={MAX_BAR}
            dataKey="advance"
            name={t('reports.credit.advances')}
            stackId="credit"
            fill="var(--color-chart-1)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <Bar
            maxBarSize={MAX_BAR}
            dataKey="loan"
            name={t('reports.credit.loans')}
            stackId="credit"
            fill="var(--color-chart-2)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <Bar
            maxBarSize={MAX_BAR}
            dataKey="manure"
            name={t('reports.credit.manure')}
            stackId="credit"
            fill="var(--color-chart-3)"
            stroke="var(--color-surface)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthsTable({ months }: { months: CreditMonth[] }) {
  const { t } = useTranslation();
  const headers = [
    t('reports.appUse.month'),
    t('reports.credit.advances'),
    t('reports.credit.loans'),
    t('reports.credit.manure'),
    t('reports.credit.teaPackets'),
    t('reports.credit.rejected'),
  ];
  // Newest first: the month just gone is the one people look up.
  const rows = [...months].reverse();
  const cell = (amount: number, count: number) => (
    <>
      {formatMoney(amount)}
      <span className="block text-caption text-text-secondary">
        {t('reports.credit.approvedCount', { count })}
      </span>
    </>
  );
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-data-cell"
        aria-label={t('reports.credit.title')}
      >
        <thead className="bg-table-header">
          <tr>
            {headers.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  'px-md py-sm text-data-header whitespace-nowrap text-text-secondary',
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
              className={cn(
                'border-b border-divider align-top',
                index % 2 === 1 && 'bg-table-row-alt',
              )}
            >
              <td className="px-md py-sm text-text-primary">{formatMonthKey(m.monthKey)}</td>
              <td className="numeric px-md py-sm text-right">
                {cell(m.advanceAmount, m.advanceCount)}
              </td>
              <td className="numeric px-md py-sm text-right">{cell(m.loanAmount, m.loanCount)}</td>
              <td className="numeric px-md py-sm text-right">
                {cell(m.manureAmount, m.manureCount)}
              </td>
              <td className="numeric px-md py-sm text-right">
                {formatCount(m.teaPackets)}
                <span className="block text-caption text-text-secondary">
                  {formatMoney(m.teaPacketAmount)}
                </span>
              </td>
              <td className="numeric px-md py-sm text-right">{formatCount(m.rejected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The table as a CSV file, the same months as on screen. */
function downloadCsv(months: CreditMonth[], t: (key: string) => string) {
  const header = [
    t('reports.appUse.month'),
    `${t('reports.credit.advances')} (LKR)`,
    t('reports.credit.advances'),
    `${t('reports.credit.loans')} (LKR)`,
    t('reports.credit.loans'),
    `${t('reports.credit.manure')} (LKR)`,
    t('reports.credit.manure'),
    t('reports.credit.teaPackets'),
    `${t('reports.credit.teaPackets')} (LKR)`,
    t('reports.credit.rejected'),
  ];
  const lines = months.map((m) => [
    m.monthKey,
    m.advanceAmount.toFixed(2),
    m.advanceCount,
    m.loanAmount.toFixed(2),
    m.loanCount,
    m.manureAmount.toFixed(2),
    m.manureCount,
    m.teaPackets,
    m.teaPacketAmount.toFixed(2),
    m.rejected,
  ]);
  const quote = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [header, ...lines].map((line) => line.map(quote).join(',')).join('\r\n');
  // A byte-order mark, so Excel reads Sinhala and Tamil headers as UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `credit-${months[0]?.monthKey ?? ''}-to-${months.at(-1)?.monthKey ?? ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
