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
import { GRID_CARD } from '@/components/ui/layout';
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
  const hasApp = params.get('hasApp');
  const page = Number(params.get('page') ?? 0);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'supplierCode', desc: false }]);

  /**
   * `hasBankDetails` is an ad-hoc extension — it is a filter the mock supports and
   * `SupplierQuery` has never declared — so it is intersected in as a string. `hasApp` is
   * a real field on the query type, which is why it is a boolean above and not here.
   */
  const query = useMemo<SupplierQuery & { hasBankDetails?: string }>(
    () => ({
      q: debouncedSearch || undefined,
      status: status ?? undefined,
      collectionPoint: collectionPoint ?? undefined,
      hasBankDetails: hasBankDetails ?? undefined,
      /**
       * Coerced here rather than passed through as a string, unlike `hasBankDetails`
       * beside it: `hasApp` is a **typed field on `SupplierQuery`**, so the query object
       * has to carry a boolean. `null` — the parameter absent from the URL — stays
       * `undefined`, which is what means *no filter at all* rather than "false".
       */
      hasApp: hasApp === null ? undefined : hasApp === 'true',
      page,
      pageSize: 50,
      sort: sorting[0]?.id ?? 'supplierCode',
      dir: sorting[0]?.desc ? 'desc' : 'asc',
    }),
    [debouncedSearch, status, collectionPoint, hasBankDetails, hasApp, page, sorting],
  );

  const { data, isPending, error, refetch } = useSuppliers(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Changing a filter resets to page 0 — page 7 of a new filter is nowhere.
    // Changing the *page* obviously must not, which is what this guard is for:
    // without it `setParam('page', '1')` set the page and then deleted it, and
    // the grid could never leave page 1.
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  /**
   * Sorting starts a new pass over the list, so it goes back to the first page.
   * Page 3 of "oldest first" is not page 3 of "by supplier code".
   */
  function handleSortingChange(next: SortingState) {
    setSorting(next);
    setParam('page', null);
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
        /**
         * v2's first column about a supplier: **do they have the app?**
         *
         * Ahead of the delivery date on purpose. The registry is the factory's own
         * console's now, and what this screen is for is app support — so the question a
         * clerk arrives with is "are they using it", not "when did they last deliver".
         *
         * Three states, not two: signed in with notifications, signed in with none
         * registered (they turned them off, or the token expired — a supplier who will
         * never see a `billPublished` push), and never installed at all. Collapsing the
         * middle one into "has the app" would hide the reason a supplier says they were
         * never told their account was ready.
         */
        accessorKey: 'hasApp',
        header: t('suppliers.column.app'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!row.hasApp) {
            return <Badge tone="neutral">{t('suppliers.app.none')}</Badge>;
          }
          return (
            <span className="flex flex-col">
              <Badge tone="success">{t('suppliers.app.installed')}</Badge>
              <span className="numeric text-caption text-text-secondary">
                {t('suppliers.app.lastSignIn', { when: formatDate(row.lastAppSignInAt) })}
              </span>
            </span>
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

      {/* The card takes the height the page header leaves and gives all of it to
          the grid: filters, column headers and pagination stay put, and only the
          rows move (§18.2 — the repetitive path is scanning rows). */}
      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
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

          {/* The list behind the dashboard's adoption percentage. A figure nobody can
              turn into names is a figure nobody acts on, which is why the card links
              straight to `?hasApp=false`. */}
          <Select
            aria-label={t('suppliers.filter.appAny')}
            value={hasApp ?? ''}
            onChange={(event) => setParam('hasApp', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('suppliers.filter.appAny')}</option>
            <option value="false">{t('suppliers.filter.appMissing')}</option>
            <option value="true">{t('suppliers.filter.appInstalled')}</option>
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

        <p className="shrink-0 px-md pt-sm text-caption text-text-secondary">
          {t('suppliers.searchHint')}
        </p>

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
          onSortingChange={handleSortingChange}
          emptyState={
            <EmptyState title={t('common.noResults')} body={t('common.noResultsHint')} />
          }
        />
      </Card>
    </>
  );
}
