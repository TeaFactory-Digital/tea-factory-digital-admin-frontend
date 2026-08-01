/**
 * M7 Credit queues — advances, loans and manure in one inbox.
 *
 * **One queue, filtered, rather than three screens.** The office does not have an
 * advances clerk and a loans clerk; somebody works the credit inbox, and the three
 * facilities differ only in how the ceiling is priced. Three screens would triple
 * the navigation to save nobody a decision — and would hide the case that matters
 * most, which is one supplier with two open facilities against one set of leaf.
 *
 * Oldest first, like every other queue here. The columns are chosen so the usual
 * decision needs no second screen: what was asked for, what they may draw, and
 * whether the first fits inside the second.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { AdminCreditRequest, CreditFacility, RequestStatus } from '@tfd/domain';
import { CREDIT_FACILITIES, CREDIT_FACILITY_FLAGS, QUEUE_SLA_HOURS } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { useFeatureFlags } from '@/config/RuntimeConfigProvider';
import { useDebounced } from '@/lib/useDebounced';
import { formatAge, formatAmount } from '@/lib/format';
import { useCreditRequests } from './hooks';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;

/**
 * The §14.4 target, per facility.
 *
 * An advance is the tightest of the three and that is not arbitrary: it is cash
 * against leaf already delivered, so the supplier has done their side and is
 * waiting on the office. A loan is underwritten against six months of history and
 * nobody expects it the same afternoon.
 */
const SLA_HOURS: Record<CreditFacility, number> = {
  advance: QUEUE_SLA_HOURS.advanceRequests,
  loan: QUEUE_SLA_HOURS.loanRequests,
  manure: QUEUE_SLA_HOURS.manureRequests,
};

export function CreditScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const flags = useFeatureFlags();
  const [params, setParams] = useSearchParams();

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);

  const status = (params.get('status') as RequestStatus | null) ?? 'pending';
  const facility = params.get('facility') as CreditFacility | null;
  const overCeiling = params.get('overCeiling') === 'true';
  const supplierId = params.get('supplierId');
  const page = Number(params.get('page') ?? 0);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'ageHours', desc: true }]);

  /**
   * Only the facilities this factory lends against.
   *
   * A tenant with `enableLoans: false` has no loan rows in the payload at all
   * (AC-07), so a filter offering "Loans" would be a control that returns nothing
   * and reads as a bug.
   */
  const availableFacilities = useMemo(
    () => CREDIT_FACILITIES.filter((name) => flags[CREDIT_FACILITY_FLAGS[name]]),
    [flags],
  );

  const query = useMemo(
    () => ({
      status,
      facility: facility ?? undefined,
      supplierId: supplierId ?? undefined,
      overCeiling: overCeiling || undefined,
      q: debouncedSearch || undefined,
      page,
      pageSize: 25,
      sort: sorting[0]?.id ?? 'ageHours',
      dir: sorting[0]?.desc ? ('desc' as const) : ('asc' as const),
    }),
    [status, facility, supplierId, overCeiling, debouncedSearch, page, sorting],
  );

  const { data, isPending, error, refetch } = useCreditRequests(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  function handleSortingChange(next: SortingState) {
    setSorting(next);
    setParam('page', null);
  }

  const columns = useMemo<ColumnDef<AdminCreditRequest, unknown>[]>(
    () => [
      {
        accessorKey: 'supplierCode',
        header: t('credit.column.supplier'),
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
        accessorKey: 'facility',
        header: t('credit.column.facility'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="text-text-primary">
                {t(`credit.facility.${info.getValue<CreditFacility>()}`)}
              </span>
              {/* Manure is taken as a quantity and settled as money — both matter,
                  so both are on the row rather than only the figure. */}
              {row.manureType ? (
                <span className="text-caption text-text-secondary">
                  {row.manureType}
                  {row.quantityKg ? ` · ${row.quantityKg} kg` : ''}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: t('credit.column.amount'),
        cell: (info) => (
          <span className="numeric font-semibold text-text-primary">
            {formatAmount(info.getValue<number>())}
          </span>
        ),
      },
      {
        id: 'available',
        header: t('credit.column.available'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          const over = row.amount > row.eligibility.available;
          return (
            <span className="flex flex-col">
              <span className="numeric text-text-primary">
                {formatAmount(row.eligibility.available)}
              </span>
              {/**
               * The judgement, on the row. Most of this queue is "yes, obviously",
               * and a clerk should be able to see which rows are not that without
               * opening fourteen records.
               */}
              {over ? (
                <Badge tone="error">{t('credit.overCeilingShort')}</Badge>
              ) : !row.eligibility.eligible ? (
                <Badge tone="warning">{t('credit.notEligibleShort')}</Badge>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'ageHours',
        header: t('credit.column.age'),
        cell: (info) => {
          const hours = info.getValue<number>();
          const row = info.row.original;
          if (row.status !== 'pending') {
            return (
              <Badge tone={STATUS_TONES[row.status]}>{t(`credit.status.${row.status}`)}</Badge>
            );
          }
          return (
            <Badge tone={hours > SLA_HOURS[row.facility] ? 'error' : 'neutral'}>
              {formatAge(hours)}
            </Badge>
          );
        },
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader title={t('credit.title')} description={t('credit.subtitle')} />

      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
          <div className="min-w-64 flex-1">
            <SearchInput
              label={t('credit.column.supplier')}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setParam('q', event.target.value || null);
              }}
            />
          </div>

          <Select
            aria-label={t('common.status')}
            value={status}
            onChange={(event) => setParam('status', event.target.value)}
            fullWidth={false}
          >
            <option value="pending">{t('credit.filter.pending')}</option>
            <option value="approved">{t('credit.filter.approved')}</option>
            <option value="rejected">{t('credit.filter.rejected')}</option>
          </Select>

          <Select
            aria-label={t('credit.column.facility')}
            value={facility ?? ''}
            onChange={(event) => setParam('facility', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('credit.filter.allFacilities')}</option>
            {availableFacilities.map((name) => (
              <option key={name} value={name}>
                {t(`credit.facility.${name}`)}
              </option>
            ))}
          </Select>

          {/* The hard cases, one click away. This is the filter an accountant
              reviewing the queue actually wants. */}
          <label className="flex items-center gap-xs text-body-small text-text-primary">
            <input
              type="checkbox"
              checked={overCeiling}
              onChange={(event) => setParam('overCeiling', event.target.checked ? 'true' : null)}
              className="size-4 rounded-sm border-border"
            />
            {t('credit.filter.overCeiling')}
          </label>
        </div>

        <DataTable
          label={t('credit.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/credit/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          emptyState={
            <EmptyState
              title={status === 'pending' ? t('credit.empty') : t('common.noResults')}
              body={status === 'pending' ? t('credit.emptyHint') : t('common.noResultsHint')}
            />
          }
        />
      </Card>
    </>
  );
}
