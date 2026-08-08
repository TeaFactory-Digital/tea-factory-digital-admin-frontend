/**
 * M18 Tea packet requests — the queue v1 never had.
 *
 * The app has offered `RequestTeaPacketsScreen` since its first release and this console
 * had nothing behind it: no type, no endpoint, no row. A supplier could ask the factory
 * for its own tea and the request went nowhere. Every other `pending` in the app is a
 * queue somewhere, and closing that loop is what M9, M10 and M7 were built for — this
 * was the one left open.
 *
 * **One screen, no detail page.** M7 needs a detail route because AC-05 makes it print
 * the eligibility working, line by line, so the approver sees exactly what the supplier
 * saw. There is no working here — a tea-packet request is a supplier, a number of
 * packets and a delivery method — so every column fits in the grid and a detail page
 * would put a click between a clerk and a decision they can already make.
 *
 * The two columns that are not obvious are the ones the storekeeper actually needs:
 * **what it weighs**, because that is what comes off a shelf, and **how it travels**,
 * because a request going back on the collection vehicle has to be ready before the
 * vehicle leaves.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type {
  AdminTeaPacketRequest,
  RequestStatus,
  TeaPacketDeliveryMethod,
} from '@tfd/domain';
import {
  DEFAULT_TEA_PACKET_POLICY,
  QUEUE_SLA_HOURS,
  isSelfApproval,
  teaPacketWeightKg,
} from '@tfd/domain';
import { useCurrentUser } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, Notice } from '@/components/ui/states';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { useDebounced } from '@/lib/useDebounced';
import { formatAge, formatAmount } from '@/lib/format';
import { TeaPacketDecisionDialog } from './TeaPacketDecisionDialog';
import { useTeaPacketRequests } from './hooks';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;

export function TeaPacketsScreen() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { config } = useRuntimeConfig();
  const [params, setParams] = useSearchParams();

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);

  const status = (params.get('status') as RequestStatus | null) ?? 'pending';
  const deliveryMethod = params.get('deliveryMethod') as TeaPacketDeliveryMethod | null;
  const supplierId = params.get('supplierId');
  const page = Number(params.get('page') ?? 0);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'ageHours', desc: true }]);
  const [deciding, setDeciding] = useState<AdminTeaPacketRequest | null>(null);

  /**
   * The store's policy, or the bundled default.
   *
   * Read here rather than per row because it is what turns a packet count into a weight
   * — and a factory that has never opened M14 still gets a number rather than a blank
   * column, which is the whole reason `DEFAULT_TEA_PACKET_POLICY` is not zeroes.
   */
  const policy = config.teaPackets ?? DEFAULT_TEA_PACKET_POLICY;

  const query = useMemo(
    () => ({
      status,
      deliveryMethod: deliveryMethod ?? undefined,
      supplierId: supplierId ?? undefined,
      q: debouncedSearch || undefined,
      page,
      pageSize: 25,
      sort: sorting[0]?.id ?? 'ageHours',
      dir: sorting[0]?.desc ? ('desc' as const) : ('asc' as const),
    }),
    [status, deliveryMethod, supplierId, debouncedSearch, page, sorting],
  );

  const { data, isPending, error, refetch } = useTeaPacketRequests(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<AdminTeaPacketRequest, unknown>[]>(
    () => [
      {
        accessorKey: 'supplierCode',
        header: t('teaPackets.column.supplier'),
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
        accessorKey: 'packets',
        header: t('teaPackets.column.packets'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="numeric font-semibold text-text-primary">{row.packets}</span>
              {/* What actually leaves the shelf. A packet count is the supplier's
                  question; kilos is the storekeeper's. */}
              <span className="numeric text-caption text-text-secondary">
                {t('teaPackets.weight', {
                  kg: teaPacketWeightKg(policy, row.packets),
                })}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: 'deliveryMethod',
        header: t('teaPackets.column.delivery'),
        cell: (info) => (
          <span className="text-text-primary">
            {t(`teaPackets.delivery.${info.getValue<TeaPacketDeliveryMethod>()}`)}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('teaPackets.column.amount'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="numeric font-semibold text-text-primary">
                {formatAmount(info.getValue<number>())}
              </span>
              {/* The price the request was quoted at, not today's. A catalogue edit
                  must never silently re-price a decision somebody already made. */}
              <span className="numeric text-caption text-text-secondary">
                {t('teaPackets.unitPrice', { price: formatAmount(row.unitPrice) })}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: 'ageHours',
        header: t('teaPackets.column.age'),
        cell: (info) => {
          const row = info.row.original;
          if (row.status !== 'pending') {
            return (
              <Badge tone={STATUS_TONES[row.status]}>{t(`teaPackets.status.${row.status}`)}</Badge>
            );
          }
          const hours = info.getValue<number>();
          return (
            <Badge tone={hours > QUEUE_SLA_HOURS.teaPacketRequests ? 'error' : 'neutral'}>
              {formatAge(hours)}
            </Badge>
          );
        },
      },
      {
        id: 'decide',
        header: '',
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (row.status !== 'pending') return null;
          /**
           * BR-501, on the row rather than in the dialog.
           *
           * A clerk who raised the request at the counter cannot decide it, and the
           * control is **withheld with the reason** rather than disabled — the same
           * choice M7 makes about `over-ceiling`. A disabled button invites "why?" and
           * a hover title is a reason nobody reads.
           */
          if (isSelfApproval(user, row.createdById)) {
            return (
              <span className="text-caption text-text-secondary">
                {t('teaPackets.fourEyes.short')}
              </span>
            );
          }
          return (
            <Button variant="secondary" onClick={() => setDeciding(row)}>
              {t('teaPackets.decide')}
            </Button>
          );
        },
      },
    ],
    [t, policy, user],
  );

  return (
    <>
      <PageHeader title={t('teaPackets.title')} description={t('teaPackets.subtitle')} />

      {/**
       * The one thing a factory can get wrong here without noticing: the flag is on, the
       * queue works, and nobody has told M14 what a packet costs. Every row would then
       * price against the bundled default, which is a real number and the wrong one.
       */}
      {config.teaPackets ? null : (
        <Notice tone="warning">
          <span>
            <strong className="font-semibold">{t('teaPackets.noPolicy.title')}</strong>{' '}
            {t('teaPackets.noPolicy.body', {
              price: formatAmount(DEFAULT_TEA_PACKET_POLICY.pricePerPacket),
            })}
          </span>
        </Notice>
      )}

      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
          <div className="min-w-64 flex-1">
            <SearchInput
              label={t('teaPackets.column.supplier')}
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
            <option value="pending">{t('teaPackets.filter.pending')}</option>
            <option value="approved">{t('teaPackets.filter.approved')}</option>
            <option value="rejected">{t('teaPackets.filter.rejected')}</option>
          </Select>

          {/**
           * Filtering by how it travels is the storekeeper's working view: the requests
           * going back on the collection vehicle have to be packed before it leaves, and
           * the ones being collected can wait for the supplier to call.
           */}
          <Select
            aria-label={t('teaPackets.column.delivery')}
            value={deliveryMethod ?? ''}
            onChange={(event) => setParam('deliveryMethod', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('teaPackets.filter.allDelivery')}</option>
            <option value="factoryCollection">{t('teaPackets.delivery.factoryCollection')}</option>
            <option value="transportVehicle">{t('teaPackets.delivery.transportVehicle')}</option>
          </Select>
        </div>

        <DataTable
          label={t('teaPackets.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onPageChange={(next) => setParam('page', String(next))}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setParam('page', null);
          }}
          emptyState={
            <EmptyState
              title={status === 'pending' ? t('teaPackets.empty') : t('common.noResults')}
              body={status === 'pending' ? t('teaPackets.emptyHint') : t('common.noResultsHint')}
            />
          }
        />
      </Card>

      {deciding ? (
        <TeaPacketDecisionDialog
          request={deciding}
          policy={policy}
          onClose={() => setDeciding(null)}
        />
      ) : null}
    </>
  );
}
