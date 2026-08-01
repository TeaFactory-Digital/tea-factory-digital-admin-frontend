/**
 * M8 Savings — what the factory is holding, and whose it is.
 *
 * The screen leads with **the balance as a liability**, because that is the question
 * the office is actually asked and the one an auditor reconciles against the bank.
 * This is suppliers' money, deducted from their accounts at their own approved rate
 * and held — not factory income — and a screen that led with "contributions this
 * month" would read like revenue.
 *
 * It is **read-only, by decision**:
 *
 *  - A contribution is created by publishing a month (M4). It is a `savings`
 *    deduction on a published bill, and there is no second way to make one — two
 *    write paths for one movement is two balances to reconcile, and the supplier's
 *    passbook and their slip would be the two that disagreed.
 *  - The savings **rate** belongs to the supplier and moves through M9's queue, which
 *    already carries the four-eyes rule and the audit trail (AC-01). A row with an
 *    open request links there rather than offering an edit.
 *  - Withdrawals and interest are §21.9 and unanswered. See the note in the passbook.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { SavingsAccount, SavingsAccountQuery } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/states';
import { useDebounced } from '@/lib/useDebounced';
import { formatAmount, formatCount, formatMoney, formatMonthKey } from '@/lib/format';
import { SavingsLedgerDialog } from './SavingsLedgerDialog';
import { useSavingsAccounts, useSavingsSummary } from './hooks';

export function SavingsScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const monthParam = params.get('month') ?? undefined;
  const filter = params.get('optedOut');
  const page = Number(params.get('page') ?? 0);

  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounced(searchText, 250);
  const [open, setOpen] = useState<SavingsAccount | null>(null);

  const summary = useSavingsSummary(monthParam);

  const query = useMemo<SavingsAccountQuery>(
    () => ({
      q: debouncedSearch || undefined,
      optedOut: filter === null ? undefined : filter === 'true',
      page,
      pageSize: 50,
    }),
    [debouncedSearch, filter, page],
  );
  const accounts = useSavingsAccounts(query);

  /**
   * Deep link from a bill: `?supplier=sup-12` opens that passbook.
   *
   * The bill's savings block links here rather than duplicating the ledger, so the
   * running balance has exactly one screen — and this is what makes that link land on
   * the right row instead of on a grid the reader has to search.
   */
  const requestedSupplier = params.get('supplier');
  useEffect(() => {
    if (!requestedSupplier || open) return;
    const match = accounts.data?.items.find((row) => row.supplierId === requestedSupplier);
    if (match) setOpen(match);
  }, [requestedSupplier, accounts.data, open]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<SavingsAccount, unknown>[]>(
    () => [
      {
        accessorKey: 'supplierCode',
        header: t('bills.column.supplier'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="numeric font-semibold text-text-primary">{row.supplierCode}</span>
              <span className="text-caption text-text-secondary">{row.supplierName}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'savingsPerKg',
        header: t('savings.column.rate'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              {/* `0` is opted out — a real answer, not a missing value. */}
              <span className="numeric text-text-primary">
                {row.savingsPerKg === 0 ? t('suppliers.optedOut') : formatAmount(row.savingsPerKg)}
              </span>
              {/* An open request is flagged, never applied: the app and this screen
                  show the **active** rate until it is decided (AC-01). */}
              {row.pendingRateChangeId ? (
                <Link
                  to={`/change-requests/${row.pendingRateChangeId}`}
                  className="text-caption text-primary underline-offset-2 hover:underline"
                >
                  {t('savings.pendingRateChange')}
                </Link>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'balance',
        header: t('savings.column.balance'),
        enableSorting: false,
        cell: (info) => (
          <span className="numeric font-semibold text-text-primary">
            {formatAmount(info.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'lastContributionMonth',
        header: t('savings.column.lastContribution'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!row.lastContributionMonth) {
            return <span className="text-text-secondary">{t('savings.neverContributed')}</span>;
          }
          return (
            <span className="flex flex-col">
              <span className="numeric text-text-primary">
                {formatMonthKey(row.lastContributionMonth)}
              </span>
              <span className="numeric text-caption text-text-secondary">
                {formatAmount(row.lastContributionAmount)}
              </span>
            </span>
          );
        },
      },
      {
        id: 'state',
        header: t('common.status'),
        enableSorting: false,
        cell: (info) =>
          info.row.original.savingsPerKg === 0 ? (
            <Badge tone="neutral">{t('suppliers.optedOut')}</Badge>
          ) : (
            <Badge tone="success">{t('savings.contributing')}</Badge>
          ),
      },
    ],
    [t],
  );

  const data = summary.data;

  return (
    <>
      <PageHeader
        title={t('savings.title')}
        description={t('savings.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            {data ? (
              <>
                <Figure label={t('savings.balanceTotal')} value={formatMoney(data.balanceTotal)} strong />
                <Figure
                  label={t('savings.contributedThisMonth', {
                    month: formatMonthKey(data.monthKey),
                  })}
                  value={formatMoney(data.contributedThisMonth)}
                />
              </>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader title={t('savings.schemeTitle')} description={t('savings.schemeDescription')} />
        <CardBody className="flex flex-col gap-md">
          {data ? (
            <>
              <dl className="grid grid-cols-2 gap-x-lg gap-y-xs sm:grid-cols-4">
                <Stat label={t('savings.stat.accounts')} value={formatCount(data.accountCount)} />
                <Stat label={t('savings.stat.optedOut')} value={formatCount(data.optedOutCount)} />
                <Stat
                  label={t('savings.stat.contributing')}
                  value={formatCount(data.contributingSuppliers)}
                />
                {/* `null` rather than `0.00` for a month that contributed nothing. */}
                <Stat label={t('savings.stat.averagePerKg')} value={formatAmount(data.averagePerKg)} />
              </dl>

              {/**
               * The trend as figures rather than a chart.
               *
               * Two series that mean different things — a month's contributions and a
               * cumulative liability — share no axis worth drawing, and the accountant
               * reconciling this wants the numbers to read off and paste. A chart here
               * would be decoration over a four-row table.
               */}
              {data.trend.length > 0 ? (
                <div className="overflow-x-auto">
                  <table
                    className="w-full border-collapse text-data-cell"
                    aria-label={t('savings.trendTitle')}
                  >
                    <thead>
                      <tr>
                        <th scope="col" className="px-sm py-xs text-left text-data-header uppercase text-text-secondary">
                          {t('savings.column.month')}
                        </th>
                        <th scope="col" className="px-sm py-xs text-right text-data-header uppercase text-text-secondary">
                          {t('savings.column.contributed')}
                        </th>
                        <th scope="col" className="px-sm py-xs text-right text-data-header uppercase text-text-secondary">
                          {t('savings.column.heldAfter')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Oldest first — the order the balance accumulated in. */}
                      {data.trend.map((row) => (
                        <tr
                          key={row.monthKey}
                          className={
                            row.monthKey === data.monthKey
                              ? 'border-b border-divider bg-primary-muted'
                              : 'border-b border-divider'
                          }
                        >
                          <td className="px-sm py-xs">
                            <button
                              type="button"
                              onClick={() => setParam('month', row.monthKey)}
                              className="numeric text-primary underline-offset-2 hover:underline"
                            >
                              {formatMonthKey(row.monthKey)}
                            </button>
                          </td>
                          <td className="numeric px-sm py-xs text-right text-text-primary">
                            {formatAmount(row.contributed)}
                          </td>
                          <td className="numeric px-sm py-xs text-right font-semibold text-text-primary">
                            {formatAmount(row.balanceTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          <p className="border-t border-divider pt-md text-caption text-text-secondary">
            {t('savings.liabilityNote')}
          </p>
        </CardBody>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-end gap-sm border-b border-divider p-md">
          <SearchInput
            label={t('savings.searchPlaceholder')}
            className="w-72"
            fullWidth={false}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />

          <label className="flex flex-col gap-xs text-label text-text-primary">
            {t('savings.filterLabel')}
            <Select
              value={filter ?? 'any'}
              onChange={(event) =>
                setParam('optedOut', event.target.value === 'any' ? null : event.target.value)
              }
              fullWidth={false}
            >
              <option value="any">{t('savings.filter.any')}</option>
              <option value="false">{t('savings.filter.contributing')}</option>
              <option value="true">{t('savings.filter.optedOut')}</option>
            </Select>
          </label>
        </div>

        <DataTable
          label={t('savings.accountsTitle')}
          columns={columns}
          page={accounts.data}
          loading={accounts.isPending}
          error={accounts.error}
          onRetry={() => void accounts.refetch()}
          getRowId={(row) => row.supplierId}
          onRowActivate={(row) => setOpen(row)}
          onPageChange={(next) => setParam('page', String(next))}
          emptyState={
            <EmptyState title={t('common.noResults')} body={t('common.noResultsHint')} />
          }
        />
      </Card>

      <SavingsLedgerDialog
        account={open}
        onClose={() => {
          setOpen(null);
          // Clear the deep link, or closing the dialog would immediately reopen it.
          if (requestedSupplier) setParam('supplier', null);
        }}
      />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-text-secondary">{label}</dt>
      <dd className="numeric text-subtitle text-text-primary">{value}</dd>
    </div>
  );
}
