/**
 * M5 Bills — a month's Green Leaf Accounts.
 *
 * The screen the accountant checks a month on **before** it is published, which is
 * the only moment anything can still be fixed. So it is built as a grid to read down
 * rather than a set of documents to open: the question is "is anything wrong here",
 * and the answers that matter are visible in columns —
 *
 *  - a balance of nothing, because the deductions swallowed the account;
 *  - a payable amount with no bank details, which a payout run cannot move;
 *  - lines that do not add up to their own total (BR-107).
 *
 * All three are **filters**, not badges to hunt for. A hundred-supplier month is a
 * hundred rows, and "show me only the ones that cannot be paid" is the query the
 * office actually runs.
 *
 * The month lives in the URL, so "check June's bills" is a link a manager can send.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { BillListItem, BillQuery } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput, Select } from '@/components/ui/Field';
import { EmptyState, Notice } from '@/components/ui/states';
import { useDebounced } from '@/lib/useDebounced';
import { formatAmount, formatKg, formatMoney } from '@/lib/format';
import { MonthSelect } from '@/modules/money/MonthSelect';
import { resolveMonthKey, useBillMonths } from '@/modules/money/monthOptions';
/* v1: `BillRunCard` — still in the tree, no longer rendered. See below. */
import { useBillRun, useBills } from './hooks';

type Lens = 'all' | 'missingBankDetails' | 'carriesDebt';

export function BillsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const months = useBillMonths();
  /**
   * Default to the month still **open**, not the newest.
   *
   * That is the one being worked: a run can still be made, corrected and checked
   * there, while a published month is a record to look up. Falls back to the newest
   * when every month is closed.
   */
  const monthKey = resolveMonthKey(months.data, params.get('month'), (month) => month.open);
  const month = months.data?.find((candidate) => candidate.monthKey === monthKey);

  const lens = (params.get('lens') as Lens | null) ?? 'all';
  const page = Number(params.get('page') ?? 0);

  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounced(searchText, 250);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'supplierCode', desc: false }]);

  const run = useBillRun(monthKey);

  const query = useMemo<BillQuery>(
    () => ({
      monthKey: monthKey || undefined,
      q: debouncedSearch || undefined,
      missingBankDetails: lens === 'missingBankDetails' || undefined,
      carriesDebt: lens === 'carriesDebt' || undefined,
      page,
      pageSize: 50,
      sort: sorting[0]?.id ?? 'supplierCode',
      dir: sorting[0]?.desc ? 'desc' : 'asc',
    }),
    [monthKey, debouncedSearch, lens, page, sorting],
  );

  const bills = useBills(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Anything but paging returns to the first page: page four of a narrower result
    // set is an empty grid that reads as "nothing matches".
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  function handleSortingChange(next: SortingState) {
    setSorting(next);
    setParam('page', null);
  }

  const columns = useMemo<ColumnDef<BillListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'supplierCode',
        header: t('bills.column.supplier'),
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
        accessorKey: 'billNo',
        header: t('bills.column.billNo'),
        cell: (info) => (
          <span className="numeric whitespace-nowrap text-text-secondary">
            {info.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'totalKgs',
        header: t('bills.column.kgs'),
        cell: (info) => <span className="numeric">{formatKg(info.getValue<number>())}</span>,
      },
      {
        accessorKey: 'grossAmount',
        header: t('bills.column.gross'),
        // `null` renders as an em dash, never `0.00`: the auction result is not in,
        // and a zero would be a figure the office has to explain (BR-102).
        cell: (info) => (
          <span className="numeric">{formatAmount(info.getValue<number | null>())}</span>
        ),
      },
      {
        accessorKey: 'deductionsTotal',
        header: t('bills.column.deductions'),
        cell: (info) => (
          <span className="numeric text-text-secondary">
            {formatAmount(info.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'finalBalance',
        header: t('bills.column.payable'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span
              className={
                row.carriesDebt
                  ? 'numeric font-semibold text-warning'
                  : 'numeric font-semibold text-text-primary'
              }
            >
              {formatAmount(row.finalBalance)}
            </span>
          );
        },
      },
      {
        id: 'flags',
        header: t('common.status'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-wrap items-center gap-xs">
              {/* Worst first: a slip that does not add up is a data fault, a missing
                  account is an office task, and a carried debt is normal. */}
              {row.unbalanced ? <Badge tone="error">{t('bills.flag.unbalanced')}</Badge> : null}
              {(row.finalBalance ?? 0) > 0 && !row.hasBankDetails ? (
                <Badge tone="warning">{t('bills.flag.noBank')}</Badge>
              ) : null}
              {row.carriesDebt ? <Badge tone="neutral">{t('bills.flag.carriesDebt')}</Badge> : null}
              <Badge tone="neutral">{t(`suppliers.payment.${row.paymentMethod}`)}</Badge>
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('bills.title')}
        description={t('bills.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            {run.data ? (
              <Figure
                label={t('bills.payableLabel')}
                value={formatMoney(run.data.payableTotal)}
                strong
              />
            ) : null}
            {month ? (
              <Badge tone={month.open ? 'info' : 'success'}>
                {t(`month.stage.${month.stage}`)}
              </Badge>
            ) : null}
            <MonthSelect
              months={months.data}
              value={monthKey}
              onChange={(next) => setParam('month', next)}
            />
          </div>
        }
      />

      {/**
        * v2: **read-only.** The office still needs this screen — a supplier telephones
        * about the figure on their phone and the clerk has to see the same account — but
        * generating a run and publishing a month are the factory's own console's work.
        *
        * `BillRunCard` is commented out rather than passed a `readOnly` prop, because the
        * card is a *control*: its whole subject is which of three states the run is in
        * and which button to press about it. A disabled version would be a card
        * explaining a decision nobody on this screen can make.
        *
        *   <BillRunCard monthKey={monthKey} month={month} run={run.data} runError={run.error} />
        */}
      <Notice tone="info">{t('bills.readOnlyNotice')}</Notice>

      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-end gap-sm border-b border-divider p-md">
          <SearchInput
            label={t('bills.searchPlaceholder')}
            className="w-72"
            fullWidth={false}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />

          <label className="flex flex-col gap-xs text-label text-text-primary">
            {t('bills.lensLabel')}
            <Select
              value={lens}
              onChange={(event) =>
                setParam('lens', event.target.value === 'all' ? null : event.target.value)
              }
              fullWidth={false}
            >
              <option value="all">{t('bills.lens.all')}</option>
              <option value="missingBankDetails">{t('bills.lens.missingBankDetails')}</option>
              <option value="carriesDebt">{t('bills.lens.carriesDebt')}</option>
            </Select>
          </label>
        </div>

        <DataTable
          label={t('bills.title')}
          columns={columns}
          page={bills.data}
          loading={bills.isPending}
          error={bills.error}
          onRetry={() => void bills.refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/bills/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          emptyState={
            <EmptyState
              title={lens === 'all' ? t('bills.empty') : t('common.noResults')}
              body={lens === 'all' ? t('bills.emptyHint') : t('common.noResultsHint')}
            />
          }
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
