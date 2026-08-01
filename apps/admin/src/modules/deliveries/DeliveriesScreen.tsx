/**
 * M3 Leaf collection — one day at one collection point.
 *
 * The screen is organised around the day, not around a list of deliveries, because
 * that is the unit the office works in: a weighing point opens, records leaf until
 * it closes, and the figure that matters at the end is the day's total. The date
 * and the point are therefore the primary controls and they live in the **URL**,
 * so a supervisor can send "look at Makadura yesterday" as a link.
 *
 * Three states this screen must tell apart, because a clerk's next action differs
 * in each:
 *
 *  - **Open** — the month accepts entries, and the session grid is offered.
 *  - **Locked** — the month is published, so the server would refuse (BR-108).
 *    The grid is not rendered at all; a disabled form that fails on submit is a
 *    worse way to say the same thing.
 *  - **Read-only user** — `deliveries: R` (clerk, manager). They see the day and
 *    its rows, and no entry grid, because §12.1 gives writing to the weigher and
 *    the accountant.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { Ban, Lock } from 'lucide-react';
import type { Delivery, DeliveryQuery } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, Notice } from '@/components/ui/states';
import { formatDateTime, formatKg, formatMonthKey } from '@/lib/format';
import { colomboToday } from '@/lib/format';
import { EntrySession } from './EntrySession';
import { VoidDeliveryDialog } from './VoidDeliveryDialog';
import { useDaySummary, useDeliveries } from './hooks';

export function DeliveriesScreen() {
  const { t } = useTranslation();
  const { config } = useRuntimeConfig();
  const [params, setParams] = useSearchParams();
  const canWrite = useCan('deliveries', 'write');

  /**
   * Today in the **factory's** timezone, not the browser's (BR-104). A clerk on a
   * laptop still set to UTC would otherwise open yesterday's sheet after 18:30.
   */
  const date = params.get('date') ?? colomboToday();
  const point = params.get('collectionPoint') ?? '';
  const page = Number(params.get('page') ?? 0);
  const includeVoided = params.get('includeVoided') === 'true';

  const [sorting, setSorting] = useState<SortingState>([{ id: 'recordedAt', desc: true }]);
  const [voiding, setVoiding] = useState<Delivery | null>(null);

  const query = useMemo<DeliveryQuery>(
    () => ({
      date,
      collectionPoint: point || undefined,
      includeVoided: includeVoided || undefined,
      page,
      pageSize: 50,
      sort: sorting[0]?.id ?? 'recordedAt',
      dir: sorting[0]?.desc ? ('desc' as const) : ('asc' as const),
    }),
    [date, point, includeVoided, page, sorting],
  );

  const { data, isPending, error, refetch } = useDeliveries(query);
  const { data: day } = useDaySummary(date, point || undefined);

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

  const columns = useMemo<ColumnDef<Delivery, unknown>[]>(
    () => [
      {
        accessorKey: 'recordedAt',
        header: t('deliveries.column.recordedAt'),
        cell: (info) => (
          <span className="numeric whitespace-nowrap text-text-secondary">
            {formatDateTime(info.getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'supplierCode',
        header: t('deliveries.column.supplier'),
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
      { accessorKey: 'collectionPoint', header: t('deliveries.column.point') },
      {
        accessorKey: 'kgs',
        header: t('deliveries.column.kgs'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span
              className={
                // A voided figure is struck through rather than hidden: it is
                // evidence, and the office may still have to account for it.
                row.voidedAt
                  ? 'numeric text-text-secondary line-through'
                  : 'numeric font-semibold text-text-primary'
              }
            >
              {formatKg(row.kgs)}
            </span>
          );
        },
      },
      {
        accessorKey: 'source',
        header: t('deliveries.column.source'),
        enableSorting: false,
        cell: (info) => (
          <Badge tone={info.getValue<string>() === 'scaleFile' ? 'info' : 'neutral'}>
            {t(`deliveries.source.${info.getValue<string>()}`)}
          </Badge>
        ),
      },
      { accessorKey: 'recordedByName', header: t('deliveries.column.recordedBy') },
      {
        id: 'state',
        header: t('common.status'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!row.voidedAt) {
            return canWrite && !day?.locked ? (
              <Button
                size="sm"
                variant="ghost"
                iconLeft={<Ban className="size-icon-sm" />}
                onClick={() => setVoiding(row)}
              >
                {t('deliveries.void')}
              </Button>
            ) : null;
          }
          return (
            <span className="flex flex-col">
              <Badge tone="error">{t('deliveries.voidedBadge')}</Badge>
              <span className="text-caption text-text-secondary">{row.voidedReason}</span>
            </span>
          );
        },
      },
    ],
    [t, canWrite, day?.locked],
  );

  return (
    <>
      <PageHeader
        title={t('deliveries.title')}
        description={t('deliveries.subtitle')}
        actions={
          day ? (
            <div className="flex flex-wrap items-center gap-md">
              <Total label={t('deliveries.totalKgs')} value={formatKg(day.totalKgs)} strong />
              <Total label={t('deliveries.supplierCount')} value={String(day.supplierCount)} />
              <Total label={t('deliveries.rowCount')} value={String(day.deliveryCount)} />
              <Badge tone={day.locked ? 'neutral' : 'success'}>
                {t(`month.stage.${day.monthStage}`)}
              </Badge>
            </div>
          ) : null
        }
      />

      {/* Locked is stated once, at the top, rather than on every control it
          disables — and it names the month, because the fix is picking another day. */}
      {day?.locked ? (
        <Notice tone="warning">
          <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          {t('deliveries.monthLocked', { month: formatMonthKey(day.monthKey) })}
        </Notice>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-end gap-sm border-b border-divider p-md">
          <label className="flex flex-col gap-xs text-label text-text-primary">
            {t('deliveries.date')}
            <Input
              type="date"
              className="numeric w-48"
              fullWidth={false}
              value={date}
              // No `max`: a factory that weighs past midnight enters yesterday's
              // sheet in the morning, and a future date is refused by the month
              // check rather than by the control.
              onChange={(event) => setParam('date', event.target.value || null)}
            />
          </label>

          <label className="flex flex-col gap-xs text-label text-text-primary">
            {t('deliveries.point')}
            <Select
              value={point}
              onChange={(event) => setParam('collectionPoint', event.target.value || null)}
              fullWidth={false}
            >
              <option value="">{t('deliveries.allPoints')}</option>
              {/* The tenant's own points, so a factory that weighs at two does not
                  see another's four. */}
              {config.collectionPoints.map((cp) => (
                <option key={cp.id} value={cp.name}>
                  {cp.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex items-center gap-xs pb-sm text-body-small text-text-primary">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={includeVoided}
              onChange={(event) => setParam('includeVoided', event.target.checked ? 'true' : null)}
            />
            {t('deliveries.showVoided')}
          </label>
        </div>

        {/**
         * The entry grid needs a point: a delivery records **where it was weighed**,
         * and "all points" is a filter, not a place. Asking for one is better than
         * defaulting, which would file a day's leaf against the wrong shed.
         */}
        {canWrite && !day?.locked ? (
          point ? (
            <div className="shrink-0 border-b border-divider bg-surface-variant">
              <EntrySession key={`${date}-${point}`} date={date} collectionPoint={point} />
            </div>
          ) : (
            <p className="shrink-0 border-b border-divider bg-surface-variant px-md py-sm text-body-small text-text-secondary">
              {t('deliveries.pickPointToEnter')}
            </p>
          )
        ) : null}

        <DataTable
          label={t('deliveries.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onPageChange={(next) => setParam('page', String(next))}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          emptyState={
            <EmptyState title={t('deliveries.empty')} body={t('deliveries.emptyHint')} />
          }
        />
      </Card>

      <VoidDeliveryDialog delivery={voiding} onClose={() => setVoiding(null)} />
    </>
  );
}

/** A figure in the page header, where the day's totals belong. */
function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
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
