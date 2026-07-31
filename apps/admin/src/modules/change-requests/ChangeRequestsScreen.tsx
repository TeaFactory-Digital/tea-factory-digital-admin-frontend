/**
 * M9 Change requests — the queue.
 *
 * Ordered **oldest first** within the pending filter, which is the opposite of
 * every other list in the console. A queue is worked front to back, and the item
 * that has waited longest is the one at risk of breaching the §14.4 target — a
 * newest-first inbox is one where the oldest item is never seen.
 *
 * "Current vs requested side by side" (§18.1 M9) is in the grid itself rather than
 * only on the detail page: most decisions are obvious, and a clerk should be able
 * to work a whole queue without opening fourteen records.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRight } from 'lucide-react';
import type { AdminChangeRequest, ChangeRequestType, RequestStatus } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { useDebounced } from '@/lib/useDebounced';
import { formatAge } from '@/lib/format';
import { useChangeRequests } from './hooks';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;

/** §14.4's target for a change request is three working days. */
const SLA_HOURS = 72;

export function ChangeRequestsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);

  const status = (params.get('status') as RequestStatus | null) ?? 'pending';
  const type = params.get('type') as ChangeRequestType | null;
  const supplierId = params.get('supplierId');
  const page = Number(params.get('page') ?? 0);

  const query = useMemo(
    () => ({
      status,
      type: type ?? undefined,
      supplierId: supplierId ?? undefined,
      q: debouncedSearch || undefined,
      page,
      pageSize: 25,
    }),
    [status, type, supplierId, debouncedSearch, page],
  );

  const { data, isPending, error, refetch } = useChangeRequests(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<AdminChangeRequest, unknown>[]>(
    () => [
      {
        id: 'supplier',
        header: t('changeRequests.column.supplier'),
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
        accessorKey: 'type',
        header: t('changeRequests.column.type'),
        enableSorting: false,
        cell: (info) => t(`changeRequests.type.${info.getValue<ChangeRequestType>()}`),
      },
      {
        accessorKey: 'currentSummary',
        header: t('changeRequests.column.current'),
        enableSorting: false,
        cell: (info) => (
          <span className="text-text-secondary">{info.getValue<string>()}</span>
        ),
      },
      {
        id: 'arrow',
        header: '',
        enableSorting: false,
        cell: () => <ArrowRight className="size-icon-sm text-text-secondary" aria-hidden />,
      },
      {
        accessorKey: 'requestedSummary',
        header: t('changeRequests.column.requested'),
        enableSorting: false,
        cell: (info) => (
          <span className="font-medium text-text-primary">{info.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'channel',
        header: t('changeRequests.column.channel'),
        enableSorting: false,
        cell: (info) => (
          <span className="text-caption text-text-secondary">
            {t(`changeRequests.channel.${info.getValue<'app' | 'office'>()}`)}
          </span>
        ),
      },
      {
        accessorKey: 'ageHours',
        header: t('changeRequests.column.age'),
        enableSorting: false,
        cell: (info) => {
          const hours = info.getValue<number>();
          const row = info.row.original;
          if (row.status !== 'pending') {
            return <Badge tone={STATUS_TONES[row.status]}>{t(`changeRequests.status.${row.status}`)}</Badge>;
          }
          // Colour *and* text: a red cell with no words is unreadable in a
          // pasted screenshot, which is how the office escalates.
          return (
            <Badge tone={hours > SLA_HOURS ? 'error' : 'neutral'}>{formatAge(hours)}</Badge>
          );
        },
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader title={t('changeRequests.title')} description={t('changeRequests.subtitle')} />

      <Card>
        <div className="flex flex-wrap items-center gap-sm border-b border-divider p-md">
          <div className="min-w-64 flex-1">
            <SearchInput
              label={t('changeRequests.column.supplier')}
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
            <option value="pending">{t('changeRequests.filter.pending')}</option>
            <option value="approved">{t('changeRequests.filter.approved')}</option>
            <option value="rejected">{t('changeRequests.filter.rejected')}</option>
          </Select>

          <Select
            aria-label={t('changeRequests.column.type')}
            value={type ?? ''}
            onChange={(event) => setParam('type', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('changeRequests.filter.allTypes')}</option>
            <option value="bankDetails">{t('changeRequests.type.bankDetails')}</option>
            <option value="paymentMethod">{t('changeRequests.type.paymentMethod')}</option>
            <option value="savingsRate">{t('changeRequests.type.savingsRate')}</option>
          </Select>
        </div>

        <DataTable
          label={t('changeRequests.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/change-requests/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          emptyState={
            <EmptyState
              title={status === 'pending' ? t('changeRequests.empty') : t('common.noResults')}
              body={
                status === 'pending' ? t('changeRequests.emptyHint') : t('common.noResultsHint')
              }
            />
          }
        />
      </Card>
    </>
  );
}
