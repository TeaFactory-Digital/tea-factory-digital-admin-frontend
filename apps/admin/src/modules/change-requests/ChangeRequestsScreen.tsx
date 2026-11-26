/**
 * M9 Change requests: the queue.
 *
 * Ordered **oldest first** within the pending filter, which is the opposite of
 * every other list in the console. A queue is worked front to back, and the item
 * that has waited longest is the one at risk of breaching the §14.4 target: a
 * newest-first inbox is one where the oldest item is never seen.
 *
 * "Current vs requested side by side" (§18.1 M9) is in the grid itself rather than
 * only on the detail page: most decisions are obvious, and a clerk should be able
 * to work a whole queue without opening fourteen records.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from '@/lib/navigate';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRight } from 'lucide-react';
import type { AdminChangeRequest, ChangeRequestType, RequestStatus } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { AgeBadge } from '@/components/ui/AgeBadge';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { useDebounced } from '@/lib/useDebounced';
import { useChangeRequests } from './hooks';
import { SUGGESTIONS as CHANGE_SUGGESTIONS } from './suggestions';
import { BulkBar, BulkDecisionDialog } from '@/components/BulkDecision';
import { selectionColumn } from '@/components/selectionColumn';
import { FactorySystemReminder } from '@/components/FactorySystemReminder';
import { useCan, useCurrentUser } from '@/auth/authStore';
import { changeRequestRepository } from '@/services/repositories/changeRequestRepository';
import { useQueryClient } from '@tanstack/react-query';
import { useLeavingRows } from '@/components/useLeavingRows';
import { qk } from '@/query/queryKeys';
import { isSelfApproval } from '@tfd/domain';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'neutral' } as const;

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

  /**
   * Oldest waiting first, always. The server orders the queue and takes no `sort`
   * parameter; sending one is refused (`422 unrecognized_keys`), so the headers are not
   * sortable. To find one supplier, search or follow the supplier's own link.
   */

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
  const rows = useMemo(() => data?.items ?? [], [data]);
  const canDecide = useCan('changeRequests', 'approve');
  const user = useCurrentUser();
  const client = useQueryClient();
  const { leaving, leave } = useLeavingRows();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<'approve' | 'reject' | null>(null);
  // One kind of change at a time: the notes for an address change mean nothing on a bank one.
  const selectedType = rows.find((row) => selected.has(row.id))?.type as ChangeRequestType | undefined;
  const decidable = useCallback(
    (row: AdminChangeRequest) =>
      row.status === 'pending' && !isSelfApproval(user, row.createdById) && (!selectedType || row.type === selectedType),
    [user, selectedType],
  );
  const bulkMode = canDecide && status === 'pending' && rows.length > 0;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Changing a filter resets to page 0: page 7 of a new filter is nowhere.
    // Changing the *page* obviously must not, which is what this guard is for:
    // without it `setParam('page', '1')` set the page and then deleted it, and
    // the grid could never leave page 1.
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<AdminChangeRequest, unknown>[]>(
    () => [
      ...(bulkMode
        ? [
            selectionColumn<AdminChangeRequest>({
              rows,
              selected,
              onChange: setSelected,
              idOf: (row) => row.id,
              nameOf: (row) => `${row.supplierCode} ${row.supplierName}`,
              selectable: decidable,
            }),
          ]
        : []),
      {
        /**
         * An `accessorKey`, not an `id`, even though the cell reads the whole row.
         *
         * TanStack refuses to sort a column with no accessor (`getCanSort()` ends
         * in `!!column.accessorFn`), so a display column renders a plain header
         * and the click does nothing, which is how this column looked sortable
         * and was not. The key doubles as the field name the server sorts on.
         */
        accessorKey: 'supplierCode',
        header: t('changeRequests.column.supplier'),
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
        cell: (info) => {
          const hours = info.getValue<number>();
          const row = info.row.original;
          if (row.status !== 'pending') {
            return <Badge tone={STATUS_TONES[row.status]}>{t(`changeRequests.status.${row.status}`)}</Badge>;
          }
          // Colour *and* text: a red cell with no words is unreadable in a
          // pasted screenshot, which is how the office escalates.
          return (
            <AgeBadge hours={hours} targetHours={SLA_HOURS} />
          );
        },
      },
    ],
    [t, bulkMode, rows, selected, decidable],
  );

  return (
    <>
      <PageHeader title={t('changeRequests.title')} description={t('changeRequests.subtitle')} />

      {/* Fixed-height card, scrolling rows. See the note in SuppliersScreen. */}
      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
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
            {/* The address joined this queue last. Everything else on this screen
                (the grid, the detail, the decision dialog) renders it with no change
                at all, because they were built against `currentSummary` and
                `requestedSummary` rather than against the three types that existed
                at the time. The filter is the one place that names them. */}
            <option value="address">{t('changeRequests.type.address')}</option>
          </Select>
        </div>

        {bulkMode ? (
          <div className="shrink-0 px-md pt-sm">
            <BulkBar
              count={selected.size}
              onApprove={() => setBulk('approve')}
              onReject={() => setBulk('reject')}
              onClear={() => setSelected(new Set())}
            />
          </div>
        ) : null}

        <DataTable
          leavingIds={leaving}
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
              kind={status === 'pending' ? 'clear' : 'search'}
              title={status === 'pending' ? t('changeRequests.empty') : t('common.noResults')}
              body={
                status === 'pending' ? t('changeRequests.emptyHint') : t('common.noResultsHint')
              }
            />
          }
        />
      </Card>

      {bulk && selectedType ? (
        <BulkDecisionDialog
          verb={bulk}
          notice={<FactorySystemReminder>{t('bulk.factoryReminder')}</FactorySystemReminder>}
          items={rows
            .filter((row) => selected.has(row.id))
            .map((row) => ({
              id: row.id,
              label: `${row.supplierCode} ${row.supplierName}`,
              detail: t(`changeRequests.type.${row.type as ChangeRequestType}`),
            }))}
          noteList={bulk === 'approve' ? 'changeRequests.approve' : 'changeRequests.reject'}
          builtIn={CHANGE_SUGGESTIONS[selectedType][bulk].map((slug) => ({
            label: t(`changeRequests.noteSuggest.${bulk}.${slug}`),
            text: t(`changeRequests.noteSuggest.${bulk}.${slug}.text`),
          }))}
          decide={(id, note) =>
            bulk === 'approve' ? changeRequestRepository.approve(id, { note }) : changeRequestRepository.reject(id, { note })
          }
          onClose={(decided) => {
            setBulk(null);
            setSelected((current) => new Set([...current].filter((id) => !decided.includes(id))));
            // The decided rows slide out, then the queue and the sidebar's counts refresh
            // together, so the badge drops as the rows go (26 November 2026).
            leave(decided, () =>
              Promise.all([
                client.invalidateQueries({ queryKey: qk.changeRequests.all }),
                client.invalidateQueries({ queryKey: qk.dashboard }),
              ]),
            );
          }}
        />
      ) : null}
    </>
  );
}
