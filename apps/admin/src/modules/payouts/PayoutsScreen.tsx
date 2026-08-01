/**
 * M6 Payouts — the runs for a month.
 *
 * A list of runs rather than a list of payments, because a run is the unit the office
 * works: it is prepared once, released once, and then reconciled line by line as the
 * bank answers. The screen's job is to make the *state* of each one unmistakable,
 * since what a clerk may do next differs completely between them —
 *
 *  - **draft** is waiting for a manager and nothing in it has moved;
 *  - **approved** is money released and being reconciled, and it is the only state a
 *    line can be marked paid in;
 *  - **completed** is every line accounted for, which is not the same as every line
 *    paid: a refused transfer is accounted for too.
 *
 * The progress figure is `paid / payable`, and **held lines are excluded from the
 * denominator**. A run that could never reach the end is a run the office stops
 * looking at, and the held lines stay counted separately so they do not disappear.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { PayoutRun, PayoutRunQuery } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { formatCount, formatDate, formatMoney } from '@/lib/format';
import { MonthSelect } from '@/modules/money/MonthSelect';
import { resolveMonthKey, useBillMonths } from '@/modules/money/monthOptions';
import { PreparePayoutRun } from './PreparePayoutRun';
import { RUN_TONES } from './tones';
import { usePayoutRuns } from './hooks';

export function PayoutsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const months = useBillMonths();
  /**
   * Default to the latest **published** month, not the open one.
   *
   * The opposite of M5's default, and for the same reason M5 chose the other way: a
   * payout run against an open month is refused, so opening on one would land the
   * clerk on a screen where the only control is disabled.
   */
  const monthKey = resolveMonthKey(months.data, params.get('month'), (month) => !month.open);
  const month = months.data?.find((candidate) => candidate.monthKey === monthKey);

  const query = useMemo<PayoutRunQuery>(
    () => ({ monthKey: monthKey || undefined, page: 0, pageSize: 50 }),
    [monthKey],
  );
  const runs = usePayoutRuns(query);
  const rows = runs.data?.items ?? [];

  function setMonth(next: string) {
    const params2 = new URLSearchParams(params);
    params2.set('month', next);
    setParams(params2, { replace: true });
  }

  const columns = useMemo<ColumnDef<PayoutRun, unknown>[]>(
    () => [
      {
        accessorKey: 'method',
        header: t('payouts.column.method'),
        enableSorting: false,
        cell: (info) => (
          <span className="font-semibold text-text-primary">
            {t(`suppliers.payment.${info.getValue<string>()}`)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-wrap items-center gap-xs">
              <Badge tone={RUN_TONES[row.status]}>{t(`payouts.status.${row.status}`)}</Badge>
              {/* Held lines are shown beside the status, never folded into it: they
                  are the reason a supplier goes unpaid, and a run can be "completed"
                  with some. */}
              {row.heldCount > 0 ? (
                <Badge tone="warning">{t('payouts.heldCount', { count: row.heldCount })}</Badge>
              ) : null}
              {row.failedCount > 0 ? (
                <Badge tone="error">{t('payouts.failedCount', { count: row.failedCount })}</Badge>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'totalAmount',
        header: t('payouts.column.total'),
        enableSorting: false,
        cell: (info) => (
          <span className="numeric font-semibold text-text-primary">
            {formatMoney(info.getValue<number>())}
          </span>
        ),
      },
      {
        id: 'progress',
        header: t('payouts.column.progress'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="numeric text-text-primary">
                {t('payouts.progress', {
                  paid: formatCount(row.paidCount),
                  total: formatCount(row.payableCount),
                })}
              </span>
              <span className="numeric text-caption text-text-secondary">
                {formatMoney(row.paidAmount)}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: 'createdByName',
        header: t('payouts.column.prepared'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="text-text-primary">{row.createdByName}</span>
              <span className="numeric text-caption text-text-secondary">
                {formatDate(row.createdAt)}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: 'approvedByName',
        header: t('payouts.column.released'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!row.approvedByName) {
            return <span className="text-text-secondary">{t('payouts.awaitingApproval')}</span>;
          }
          return (
            <span className="flex flex-col">
              <span className="text-text-primary">{row.approvedByName}</span>
              <span className="numeric text-caption text-text-secondary">
                {formatDate(row.approvedAt)}
              </span>
            </span>
          );
        },
      },
    ],
    [t],
  );

  const payableTotal = rows.reduce((sum, run) => sum + run.totalAmount, 0);
  const paidTotal = rows.reduce((sum, run) => sum + run.paidAmount, 0);

  return (
    <>
      <PageHeader
        title={t('payouts.title')}
        description={t('payouts.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            <Figure label={t('payouts.monthTotal')} value={formatMoney(payableTotal)} strong />
            <Figure label={t('payouts.monthPaid')} value={formatMoney(paidTotal)} />
            {month ? (
              <Badge tone={month.open ? 'warning' : 'success'}>
                {t(`month.stage.${month.stage}`)}
              </Badge>
            ) : null}
            <MonthSelect months={months.data} value={monthKey} onChange={setMonth} />
          </div>
        }
      />

      <PreparePayoutRun monthKey={monthKey} month={month} existing={rows} />

      <Card className={GRID_CARD}>
        <DataTable
          label={t('payouts.title')}
          columns={columns}
          page={runs.data}
          loading={runs.isPending}
          error={runs.error}
          onRetry={() => void runs.refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/payouts/${row.id}`)}
          // A month has at most three runs — one per method — so there is no page
          // to move to and the month picker is what changes the set.
          onPageChange={() => {}}
          emptyState={<EmptyState title={t('payouts.empty')} body={t('payouts.emptyHint')} />}
        />
      </Card>
    </>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-caption text-text-secondary">{label}</span>
      <span
        className={
          strong ? 'numeric text-h3 text-text-primary' : 'numeric text-subtitle text-text-primary'
        }
      >
        {value}
      </span>
    </div>
  );
}
