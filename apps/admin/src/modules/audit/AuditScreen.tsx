/**
 * M17 Audit log — filterable, read-only, exportable.
 *
 * Built in this milestone rather than deferred, for one reason: AC-09 says every
 * decision appears here with actor and before/after, and an acceptance criterion
 * with no screen behind it cannot be signed off. Export is listed in §18.1 and is
 * not built yet — that gap is recorded in docs/status.md rather than implied by a
 * disabled button.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { AuditEntry } from '@tfd/domain';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { auditActionLabel } from '@/lib/auditLabels';
import { formatDateTime } from '@/lib/format';

const ENTITIES = ['changeRequest', 'supplier', 'monthlyRate'] as const;

export function AuditScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const entity = params.get('entity');
  const page = Number(params.get('page') ?? 0);

  /**
   * Newest first, and sortable — an auditor reconstructing a sequence reads the
   * log the other way round, and "who touched this first" is a question the
   * default order answers backwards.
   */
  const [sorting, setSorting] = useState<SortingState>([{ id: 'at', desc: true }]);

  const query = useMemo(
    () => ({
      entity: entity ?? undefined,
      page,
      pageSize: 50,
      sort: sorting[0]?.id ?? 'at',
      dir: sorting[0]?.desc ? ('desc' as const) : ('asc' as const),
    }),
    [entity, page, sorting],
  );

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.audit.list(query),
    queryFn: () => auditRepository.list(query),
    placeholderData: (previous) => previous,
  });

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

  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: 'at',
        header: t('audit.column.when'),
        cell: (info) => (
          <span className="numeric whitespace-nowrap text-text-secondary">
            {formatDateTime(info.getValue<string>())}
          </span>
        ),
      },
      { accessorKey: 'actorName', header: t('audit.column.actor') },
      {
        accessorKey: 'action',
        header: t('audit.column.action'),
        cell: (info) => auditActionLabel(info.getValue<string>(), t),
      },
      {
        id: 'entity',
        header: t('audit.column.entity'),
        enableSorting: false,
        cell: (info) => (
          <span className="numeric text-text-secondary">
            {info.row.original.entity} · {info.row.original.entityId}
          </span>
        ),
      },
      {
        id: 'change',
        header: t('audit.column.change'),
        enableSorting: false,
        cell: (info) => {
          const { before, after } = info.row.original;
          return (
            <span className="text-caption text-text-secondary">
              {before ? `${JSON.stringify(before)} → ` : ''}
              {after ? JSON.stringify(after) : ''}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader title={t('audit.title')} />

      {/* Fixed-height card, scrolling rows — see the note in SuppliersScreen. */}
      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
          <Select
            aria-label={t('audit.column.entity')}
            value={entity ?? ''}
            onChange={(event) => setParam('entity', event.target.value || null)}
            fullWidth={false}
          >
            <option value="">{t('audit.filter.allEntities')}</option>
            {ENTITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>

        <DataTable
          label={t('audit.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onPageChange={(next) => setParam('page', String(next))}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          emptyState={<EmptyState title={t('audit.empty')} />}
        />
      </Card>
    </>
  );
}
