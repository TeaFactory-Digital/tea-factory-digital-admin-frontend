/**
 * M17 Audit log — filterable, read-only, exportable.
 *
 * Built in this milestone rather than deferred, for one reason: AC-09 says every
 * decision appears here with actor and before/after, and an acceptance criterion
 * with no screen behind it cannot be signed off. Export is listed in §18.1 and is
 * not built yet — that gap is recorded in docs/status.md rather than implied by a
 * disabled button.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import type { AuditEntry } from '@tfd/domain';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';
import { Card } from '@/components/ui/Card';
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

  const query = useMemo(
    () => ({ entity: entity ?? undefined, page, pageSize: 50 }),
    [entity, page],
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
    next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: 'at',
        header: t('audit.column.when'),
        enableSorting: false,
        cell: (info) => (
          <span className="numeric whitespace-nowrap text-text-secondary">
            {formatDateTime(info.getValue<string>())}
          </span>
        ),
      },
      { accessorKey: 'actorName', header: t('audit.column.actor'), enableSorting: false },
      {
        accessorKey: 'action',
        header: t('audit.column.action'),
        enableSorting: false,
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

      <Card>
        <div className="flex flex-wrap items-center gap-sm border-b border-divider p-md">
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
          emptyState={<EmptyState title={t('audit.empty')} />}
        />
      </Card>
    </>
  );
}
