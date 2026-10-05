/**
 * Savings held, across the factory: how much it is holding for suppliers, for how many,
 * and what came in and went out each month.
 *
 * **Read only.** The figures are the factory system's (factory-integration-spec §1.1);
 * this console shows a copy and records nothing. A supplier's own lines are on their
 * record (Suppliers → Money → Savings passbook).
 *
 * The API leaves the report out (`404`) when the factory runs no savings scheme, and the
 * tab says so rather than showing an error.
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
import { ArrowDownLeft, ArrowUpRight, Download, PiggyBank, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatCount, formatMoney, formatMonthKey } from '@/lib/format';
import { isApiError } from '@/services/api/errors';
import type { SavingsMonth } from '@/services/repositories/reportRepository';
import { useSavingsHeld } from './hooks';

const RANGES = [6, 12, 0] as const; // 0 = every month
type Range = (typeof RANGES)[number];

export function SavingsReport() {
  const { t } = useTranslation();
  const query = useSavingsHeld();
  const [range, setRange] = useState<Range>(12);

  const months = useMemo(() => {
    const all = query.data ?? [];
    return range === 0 ? all : all.slice(-range);
  }, [query.data, range]);

  const latest = months.at(-1);
  const paidIn = months.reduce((sum, m) => sum + m.paidIn, 0);
  const takenOut = months.reduce((sum, m) => sum + m.takenOut, 0);

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
  if (isApiError(query.error) && query.error.code === 'feature-disabled') {
    return <Notice tone="info">{t('reports.savings.disabled')}</Notice>;
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  // The report is left out of the catalogue (and answers 404) when the factory runs no
  // savings scheme, so a 404 here means exactly that.
  if (query.data === null) {
    return <Notice tone="info">{t('reports.savings.disabled')}</Notice>;
  }
  if (months.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title={t('reports.savings.empty')} body={t('reports.savings.emptyHint')} />
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div
        role="group"
        aria-label={t('reports.appUse.period')}
        className="inline-flex self-start rounded-md border border-border bg-surface p-xxs"
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

      <section
        aria-label={t('reports.appUse.summary')}
        className="grid gap-md sm:grid-cols-2 xl:grid-cols-4"
      >
        <Tile
          icon={PiggyBank}
          tone="primary"
          label={t('reports.savings.held')}
          value={formatMoney(latest?.balanceTotal ?? 0)}
          hint={t('reports.savings.heldHint', { month: formatMonthKey(latest?.monthKey) })}
        />
        <Tile
          icon={Users}
          label={t('reports.savings.suppliers')}
          value={formatCount(latest?.suppliersSaving ?? 0)}
          hint={t('reports.savings.suppliersHint')}
        />
        <Tile
          icon={ArrowDownLeft}
          label={t('reports.savings.paidIn')}
          value={formatMoney(paidIn)}
          hint={t('reports.appUse.totalHint')}
        />
        <Tile
          icon={ArrowUpRight}
          label={t('reports.savings.takenOut')}
          value={formatMoney(takenOut)}
          hint={t('reports.appUse.totalHint')}
        />
      </section>

      <Card>
        <CardHeader
          title={t('reports.appUse.chartTitle')}
          description={t('reports.savings.chartHint')}
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
        <MonthsTable months={months} totals={{ paidIn, takenOut }} />
      </Card>
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
  icon: typeof PiggyBank;
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

/** Paid in against taken out, month by month. */
function MonthsChart({ months }: { months: SavingsMonth[] }) {
  const { t } = useTranslation();
  const data = months.map((m) => ({
    month: formatMonthKey(m.monthKey),
    paidIn: m.paidIn,
    takenOut: m.takenOut,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
            width={64}
            fontSize={12}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-variant)' }}
            formatter={(value) => formatMoney(Number(value))}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-caption)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="paidIn"
            name={t('reports.savings.paidIn')}
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="takenOut"
            name={t('reports.savings.takenOut')}
            fill="var(--color-warning)"
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
  months: SavingsMonth[];
  totals: { paidIn: number; takenOut: number };
}) {
  const { t } = useTranslation();
  const headers = [
    t('reports.appUse.month'),
    t('reports.savings.paidIn'),
    t('reports.savings.takenOut'),
    t('reports.savings.balanceEnd'),
    t('reports.savings.suppliers'),
  ];
  // Newest first: the month just gone is the one people look up.
  const rows = [...months].reverse();
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-data-cell"
        aria-label={t('reports.savings.title')}
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
              className={cn('border-b border-divider', index % 2 === 1 && 'bg-table-row-alt')}
            >
              <td className="px-md py-sm text-text-primary">{formatMonthKey(m.monthKey)}</td>
              <td className="numeric px-md py-sm text-right text-success">
                {formatMoney(m.paidIn)}
              </td>
              <td className="numeric px-md py-sm text-right text-warning">
                {formatMoney(m.takenOut)}
              </td>
              <td className="numeric px-md py-sm text-right font-medium">
                {formatMoney(m.balanceTotal)}
              </td>
              <td className="numeric px-md py-sm text-right">{formatCount(m.suppliersSaving)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="px-md py-sm text-text-primary">{t('reports.appUse.periodTotal')}</td>
            <td className="numeric px-md py-sm text-right">{formatMoney(totals.paidIn)}</td>
            <td className="numeric px-md py-sm text-right">{formatMoney(totals.takenOut)}</td>
            <td className="px-md py-sm" />
            <td className="px-md py-sm" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** The table as a CSV file, the same columns and months as on screen. */
function downloadCsv(months: SavingsMonth[], t: (key: string) => string) {
  const header = [
    t('reports.appUse.month'),
    t('reports.savings.paidIn'),
    t('reports.savings.takenOut'),
    t('reports.savings.balanceEnd'),
    t('reports.savings.suppliers'),
  ];
  const lines = months.map((m) => [
    m.monthKey,
    m.paidIn.toFixed(2),
    m.takenOut.toFixed(2),
    m.balanceTotal.toFixed(2),
    m.suppliersSaving,
  ]);
  const quote = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [header, ...lines].map((line) => line.map(quote).join(',')).join('\r\n');
  // A byte-order mark, so Excel reads Sinhala and Tamil headers as UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `savings-${months[0]?.monthKey ?? ''}-to-${months.at(-1)?.monthKey ?? ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
