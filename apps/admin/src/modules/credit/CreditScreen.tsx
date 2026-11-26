/**
 * M7 Credit queues: advances, loans and manure in one inbox.
 *
 * **One queue, filtered, rather than three screens.** The office does not have an
 * advances clerk and a loans clerk; somebody works the credit inbox, and the three
 * facilities differ only in how the ceiling is priced. Three screens would triple
 * the navigation to save nobody a decision, and would hide the case that matters
 * most, which is one supplier with two open facilities against one set of leaf.
 *
 * Oldest first, like every other queue here. The columns are chosen so the usual
 * decision needs no second screen: what was asked for, what they may draw, and
 * whether the first fits inside the second.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useNavigate } from '@/lib/navigate';
import type { ColumnDef } from '@tanstack/react-table';
import type { AdminCreditRequest, CreditFacility, RequestStatus } from '@tfd/domain';
import { CREDIT_FACILITIES, CREDIT_FACILITY_FLAGS, QUEUE_SLA_HOURS } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { AgeBadge } from '@/components/ui/AgeBadge';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { BulkBar, BulkDecisionDialog } from '@/components/BulkDecision';
import { selectionColumn } from '@/components/selectionColumn';
import { FactorySystemReminder } from '@/components/FactorySystemReminder';
import { useAuthStore, useCurrentUser } from '@/auth/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { useLeavingRows } from '@/components/useLeavingRows';
import { qk } from '@/query/queryKeys';
import { DEFAULT_CREDIT_RULES, approvalTierFor, canDecideCredit, isSelfApproval } from '@tfd/domain';
import { SUGGESTIONS as CREDIT_SUGGESTIONS } from './suggestions';
import { SearchInput, Select } from '@/components/ui/Field';
import { Label } from '@/components/ui/Label';
import { creditRepository } from '@/services/repositories/creditRepository';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { useFeatureFlags, useKeepsFactoryRecords, useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { useCan } from '@/auth/authStore';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImportMenu } from '@/components/ImportMenu';
import { WalkInCreditDialog } from './WalkInCreditDialog';
import { useDebounced } from '@/lib/useDebounced';
import { formatAmount, formatQuantityKg } from '@/lib/format';
import { useCreditRequests } from './hooks';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'neutral' } as const;

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
  // While the factory-system sync is off, counter requests are recorded here so the bill
  // deducts them.
  const keepsRecords = useKeepsFactoryRecords();
  const canRecord = useCan('creditRequests', 'write');
  // Opened from Ctrl+K's "Record walk-in credit": the dialog is already open.
  const location = useLocation();
  const [recording, setRecording] = useState(() => (location.state as { action?: string } | null)?.action === 'add');

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);

  const status = (params.get('status') as RequestStatus | null) ?? 'pending';
  const facility = params.get('facility') as CreditFacility | null;
  const overCeiling = params.get('overCeiling') === 'true';
  const supplierId = params.get('supplierId');
  const page = Number(params.get('page') ?? 0);
  // Oldest waiting first, always: the server orders the queue and takes no sort parameter.

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
    }),
    [status, facility, supplierId, overCeiling, debouncedSearch, page],
  );

  const { data, isPending, error, refetch } = useCreditRequests(query);
  const rows = useMemo(() => data?.items ?? [], [data]);
  const user = useCurrentUser();
  const grants = useAuthStore((st) => st.grants);
  const { config } = useRuntimeConfig();
  const client = useQueryClient();
  const { leaving, leave } = useLeavingRows();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<'approve' | 'reject' | null>(null);

  /** A request this user may decide here, as the single decision would allow it. */
  const decidable = useCallback(
    (row: AdminCreditRequest): boolean => {
      if (row.status !== 'pending' || !row.eligibility) return false;
      const tier = approvalTierFor(row.amount, (config.creditRules ?? DEFAULT_CREDIT_RULES)[row.facility]);
      return canDecideCredit(grants, tier) && !isSelfApproval(user, row.createdById);
    },
    [config, grants, user],
  );
  const bulkMode = status === 'pending' && rows.some(decidable);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<AdminCreditRequest, unknown>[]>(
    () => [
      ...(bulkMode
        ? [
            selectionColumn<AdminCreditRequest>({
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
              {/* Manure is taken as a quantity and settled as money; both matter,
                  so both are on the row rather than only the figure. */}
              {row.manureType ? (
                <span className="text-caption text-text-secondary">
                  {row.manureType}
                  {row.quantityKg ? ` · ${formatQuantityKg(row.quantityKg)}` : ''}
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
          const eligibility = row.eligibility;
          // Rejected and cancelled rows carry no figures; a dash, not a crash.
          if (!eligibility) return <span className="text-text-secondary">{formatAmount(null)}</span>;
          const over = row.amount > eligibility.available;
          return (
            <span className="flex flex-col">
              <span className="numeric text-text-primary">
                {formatAmount(eligibility.available)}
              </span>
              {/**
               * The judgement, on the row. Most of this queue is "yes, obviously",
               * and a clerk should be able to see which rows are not that without
               * opening fourteen records.
               */}
              {over ? (
                <Badge tone="error">{t('credit.overCeilingShort')}</Badge>
              ) : !eligibility.eligible ? (
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
            <AgeBadge hours={hours} targetHours={SLA_HOURS[row.facility]} />
          );
        },
      },
    ],
    [t, bulkMode, rows, selected, decidable],
  );

  return (
    <>
      <PageHeader
        title={t('credit.title')}
        description={t('credit.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-sm">
            <ExportCsvButton
              name="credit-requests"
              fetchPage={(page, pageSize) => creditRepository.list({ ...query, page, pageSize })}
              columns={[
                { header: t('export.column.date'), value: (r) => r.createdAt.slice(0, 10) },
                { header: t('changeRequests.column.supplier'), value: (r) => `${r.supplierCode} ${r.supplierName}` },
                { header: t('export.column.type'), value: (r) => t(`credit.facility.${r.facility}`) },
                { header: t('export.column.amount'), value: (r) => r.amount.toFixed(2) },
                { header: t('export.column.details'), value: (r) => r.manureType ?? r.reason ?? '' },
                { header: t('common.status'), value: (r) => t(`credit.status.${r.status}`) },
                { header: t('export.column.decidedBy'), value: (r) => r.decision?.decidedByName ?? '' },
              ]}
            />
            {keepsRecords && canRecord ? (
              <>
                <ImportMenu kinds={['walkInCredit']} />
                <Button
                  variant="primary"
                  iconLeft={<Plus className="size-icon-sm" aria-hidden />}
                  onClick={() => setRecording(true)}
                >
                  {t('records.walkIn.button')}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

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
            <option value="cancelled">{t('credit.filter.cancelled')}</option>
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
          <Label className="flex items-center gap-xs text-body-small text-text-primary">
            <Checkbox
              checked={overCeiling}
              onCheckedChange={(checked) =>
                setParam('overCeiling', checked === true ? 'true' : null)
              }
            />
            {t('credit.filter.overCeiling')}
          </Label>
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
          label={t('credit.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/credit/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          emptyState={
            <EmptyState
              kind={status === 'pending' ? 'clear' : 'search'}
              title={status === 'pending' ? t('credit.empty') : t('common.noResults')}
              body={status === 'pending' ? t('credit.emptyHint') : t('common.noResultsHint')}
            />
          }
        />
      </Card>
      {recording ? <WalkInCreditDialog onClose={() => setRecording(false)} /> : null}

      {bulk ? (
        <BulkDecisionDialog
          verb={bulk}
          notice={<FactorySystemReminder>{t('bulk.factoryReminder')}</FactorySystemReminder>}
          items={rows
            .filter((row) => selected.has(row.id))
            .map((row) => ({
              id: row.id,
              label: `${row.supplierCode} ${row.supplierName}`,
              detail: formatAmount(row.amount),
              // The amount has to fit the supplier's headroom now; the server checks it too.
              skip:
                bulk === 'approve' && row.eligibility && row.amount > row.eligibility.available
                  ? t('bulk.overLimit')
                  : undefined,
            }))}
          noteList={bulk === 'approve' ? 'credit.approve' : 'credit.reject'}
          builtIn={CREDIT_SUGGESTIONS[bulk].map((slug) => ({
            label: t(`credit.noteSuggest.${bulk}.${slug}`),
            text: t(`credit.noteSuggest.${bulk}.${slug}.text`),
          }))}
          decide={(id, note) => {
            const row = rows.find((one) => one.id === id)!;
            const body = { note, ceilingSeen: row.eligibility?.ceiling ?? 0 };
            return bulk === 'approve'
              ? creditRepository.approve(id, body, { amount: row.amount, available: row.eligibility?.available ?? 0 })
              : creditRepository.reject(id, body);
          }}
          onClose={(decided) => {
            setBulk(null);
            setSelected((current) => new Set([...current].filter((id) => !decided.includes(id))));
            // The decided rows slide out, then the queue and the sidebar's counts refresh
            // together, so the badge drops as the rows go (26 November 2026).
            leave(decided, () =>
              Promise.all([
                client.invalidateQueries({ queryKey: qk.credit.all }),
                client.invalidateQueries({ queryKey: qk.dashboard }),
              ]),
            );
          }}
        />
      ) : null}
    </>
  );
}
