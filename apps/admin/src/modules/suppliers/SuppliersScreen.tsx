/**
 * M2 Suppliers — the list.
 *
 * Search is the primary interaction, so it takes the focus on mount and it is
 * debounced rather than submitted: the office knows a supplier by their code and
 * types four digits, and pressing Enter afterwards is a keystroke that buys
 * nothing.
 *
 * Filter state lives in the **URL**, not in component state. That is what makes
 * the dashboard's "12 suppliers have no bank details" alert able to link straight
 * to the filtered grid, and what lets a clerk send a colleague a link to exactly
 * what they are looking at.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { SupplierListItem, SupplierQuery, SupplierStatus } from '@tfd/domain';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { useDebounced } from '@/lib/useDebounced';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { formatAmount, formatDate } from '@/lib/format';
import { useSuppliers } from './hooks';

const STATUS_TONES = { active: 'success', suspended: 'warning', closed: 'neutral' } as const;

export function SuppliersScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config } = useRuntimeConfig();
  const [params, setParams] = useSearchParams();

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);

  const status = params.get('status') as SupplierStatus | null;
  const collectionPoint = params.get('collectionPoint');
  const hasBankDetails = params.get('hasBankDetails');
  const page = Number(params.get('page') ?? 0);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'supplierCode', desc: false }]);

  const query = useMemo<SupplierQuery & { hasBankDetails?: string }>(
    () => ({
      q: debouncedSearch || undefined,
      status: status ?? undefined,
      collectionPoint: collectionPoint ?? undefined,
      hasBankDetails: hasBankDetails ?? undefined,
      page,
      pageSize: 50,
      sort: sorting[0]?.id ?? 'supplierCode',
      dir: sorting[0]?.desc ? 'desc' : 'asc',
    }),
    [debouncedSearch, status, collectionPoint, hasBankDetails, page, sorting],
  );

  const { data, isPending, error, refetch } = useSuppliers(query);

  /** Changing a filter resets to page 0 — page 7 of a new filter is nowhere. */
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<SupplierListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'supplierCode',
        header: t('suppliers.column.code'),
        cell: (info) => (
          <span className="numeric font-semibold text-text-primary">
            {info.getValue<string>()}
          </span>
        ),
      },
      { accessorKey: 'name', header: t('suppliers.column.name') },
      {
        accessorKey: 'nic',
        header: t('suppliers.column.nic'),
        cell: (info) => <span className="numeric">{info.getValue<string>()}</span>,
      },
      { accessorKey: 'collectionPoint', header: t('suppliers.column.point') },
      {
        accessorKey: 'status',
        header: t('suppliers.column.status'),
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue<SupplierStatus>();
          return <Badge tone={STATUS_TONES[value]}>{t(`suppliers.status.${value}`)}</Badge>;
        },
      },
      {
        accessorKey: 'paymentMethod',
        header: t('suppliers.column.payment'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex items-center gap-xs">
              {t(`suppliers.payment.${row.paymentMethod}`)}
              {/* Missing bank details is not cosmetic: it is an M4 exception that
                  will block publishing the month (AC-04), so it is flagged here
                  where a clerk can fix it weeks earlier. */}
              {!row.hasBankDetails ? (
                <Badge tone="warning">{t('suppliers.noBankDetails')}</Badge>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'savingsPerKg',
        header: t('suppliers.column.savings'),
        cell: (info) => {
          const value = info.getValue<number>();
          return value === 0 ? (
            <span className="text-text-secondary">{t('suppliers.optedOut')}</span>
          ) : (
            <span className="numeric">{formatAmount(value)}</span>
          );
        },
      },
      {
        accessorKey: 'lastDeliveryAt',
        header: t('suppliers.column.lastDelivery'),
        cell: (info) => (
          <span className="numeric text-text-secondary">
            {formatDate(info.getValue<string | null>())}
          </span>
        ),
      },
      {
        accessorKey: 'pendingRequests',
        header: t('suppliers.column.pending'),
        enableSorting: false,
        cell: (info) => {
          const count = info.getValue<number>();
          return count > 0 ? <Badge tone="info">{count}</Badge> : null;
        },
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader title={t('suppliers.title')} description={t('suppliers.subtitle')} />

      <Card>
        <div className="flex flex-wrap items-center gap-sm border-b border-divider p-md">
          <div className="min-w-64 flex-1">
            <SearchInput
              label={t('suppliers.searchPlaceholder')}
              value={searchText}
              autoFocus
              onChange={(event) => {
                setSearchText(event.target.value);
                setParam('q', event.target.value || null);
              }}
            />
          </div>

          <Select
            aria-label={t('suppliers.column.status')}
            value={status ?? ''}
            onChange={(event) => setParam('status', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('suppliers.filter.allStatuses')}</option>
            <option value="active">{t('suppliers.status.active')}</option>
            <option value="suspended">{t('suppliers.status.suspended')}</option>
            <option value="closed">{t('suppliers.status.closed')}</option>
          </Select>

          <Select
            aria-label={t('suppliers.column.point')}
            value={collectionPoint ?? ''}
            onChange={(event) => setParam('collectionPoint', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('suppliers.filter.allPoints')}</option>
            {/* Collection points come from the tenant's config, so a factory that
                weighs at two points does not see another's four. */}
            {config.collectionPoints.map((point) => (
              <option key={point.id} value={point.name}>
                {point.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label={t('suppliers.filter.noBankDetails')}
            value={hasBankDetails ?? ''}
            onChange={(event) => setParam('hasBankDetails', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('suppliers.filter.anyBankDetails')}</option>
            <option value="false">{t('suppliers.filter.noBankDetails')}</option>
          </Select>
        </div>

        <p className="px-md pt-sm text-caption text-text-secondary">{t('suppliers.searchHint')}</p>

        <DataTable
          label={t('suppliers.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/suppliers/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          sorting={sorting}
          onSortingChange={setSorting}
          emptyState={
            <EmptyState title={t('common.noResults')} body={t('common.noResultsHint')} />
          }
        />
      </Card>
    </>
  );
}
