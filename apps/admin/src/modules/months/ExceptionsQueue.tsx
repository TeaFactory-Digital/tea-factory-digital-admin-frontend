/**
 * The exceptions blocking a month, as a work queue.
 *
 * A **list of records, not a count** (api-contract.md §10.4). AC-04 requires the
 * accountant to resolve each one, and each therefore needs an id, a type, and a
 * link to the record it is about — a badge reading "11 open exceptions" can be
 * looked at but not worked through.
 *
 * Unresolved first, oldest first within that, because the queue is worked front to
 * back before a publish. Resolved rows stay visible behind a filter rather than
 * disappearing: "who decided this was acceptable, and why" is the question an
 * auditor asks about a month that closed with exceptions on it.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { MonthException, MonthSummary } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useMonthExceptions, useResolveException } from './hooks';

const MIN_NOTE = 10;

/** Where to go and fix it. An exception with no link is a puzzle, not a task. */
function hrefFor(exception: MonthException): string | null {
  switch (exception.entity) {
    case 'supplier':
      return `/suppliers/${exception.entityId}`;
    case 'changeRequest':
      return `/change-requests/${exception.entityId}`;
    case 'delivery':
      // Deliveries have no detail page; the day they were weighed on is the place
      // a clerk can act, which is what the row's own date gives us.
      return '/deliveries';
    default:
      return null;
  }
}

export function ExceptionsQueue({ month }: { month: MonthSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const canResolve = useCan('ratesAndMonthClose', 'write');
  const resolve = useResolveException(month.monthKey);

  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [target, setTarget] = useState<MonthException | null>(null);
  const [note, setNote] = useState('');

  const resolved = filter === 'all' ? undefined : filter === 'resolved';
  const { data, isPending, error, refetch } = useMonthExceptions(month.monthKey, resolved);

  async function submit() {
    if (!target) return;
    try {
      await resolve.mutateAsync({ id: target.id, note: note.trim() });
      toast.success(t('months.exceptionResolved'));
      setTarget(null);
      setNote('');
    } catch (cause) {
      toast.error(t('months.exceptionResolveFailed'), t(errorMessageKey(cause)));
    }
  }

  const columns = useMemo<ColumnDef<MonthException, unknown>[]>(
    () => [
      {
        accessorKey: 'type',
        header: t('months.column.type'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <Badge tone={row.resolvedAt ? 'neutral' : 'warning'}>
              {t(`months.exception.${row.type}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'supplierCode',
        header: t('months.column.supplier'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!row.supplierCode) return <span className="text-text-secondary">—</span>;
          return (
            <span className="flex flex-col">
              <span className="numeric font-semibold text-text-primary">{row.supplierCode}</span>
              <span className="text-caption text-text-secondary">{row.supplierName}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'detail',
        header: t('months.column.detail'),
        enableSorting: false,
        cell: (info) => (
          <span className="flex flex-col">
            <span className="text-text-primary">{info.getValue<string>()}</span>
            {info.row.original.resolutionNote ? (
              <span className="text-caption text-text-secondary">
                {t('months.resolvedByNote', {
                  name: info.row.original.resolvedByName ?? '—',
                  note: info.row.original.resolutionNote,
                })}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: 'raisedAt',
        header: t('months.column.raised'),
        enableSorting: false,
        cell: (info) => (
          <span className="numeric whitespace-nowrap text-text-secondary">
            {formatDateTime(info.getValue<string>())}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          const href = hrefFor(row);
          if (row.resolvedAt) {
            return (
              <span className="numeric whitespace-nowrap text-caption text-text-secondary">
                {formatDateTime(row.resolvedAt)}
              </span>
            );
          }
          return (
            <span className="flex items-center gap-xs">
              {href ? (
                <Link
                  to={href}
                  className="text-label text-primary underline-offset-2 hover:underline"
                >
                  {t('months.openRecord')}
                </Link>
              ) : null}
              {canResolve && month.open ? (
                <Button size="sm" variant="secondary" onClick={() => setTarget(row)}>
                  {t('months.resolve')}
                </Button>
              ) : null}
            </span>
          );
        },
      },
    ],
    [t, canResolve, month.open],
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader
        title={t('months.exceptionsTitle')}
        description={t('months.exceptionsDescription')}
        className="shrink-0"
        actions={
          <Select
            aria-label={t('months.filterExceptions')}
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            fullWidth={false}
          >
            <option value="open">{t('months.filter.open', { count: month.openExceptions })}</option>
            <option value="resolved">{t('months.filter.resolved')}</option>
            <option value="all">{t('months.filter.all')}</option>
          </Select>
        }
      />

      <DataTable
        label={t('months.exceptionsTitle')}
        columns={columns}
        page={data}
        loading={isPending}
        error={error}
        onRetry={() => void refetch()}
        getRowId={(row) => row.id}
        // Exceptions are a bounded list — a month has tens, not thousands — so the
        // filter changes the set and there is no page to move to.
        onPageChange={() => {}}
        emptyState={
          <EmptyState
            title={filter === 'open' ? t('months.noOpenExceptions') : t('common.noResults')}
            body={filter === 'open' ? t('months.noOpenExceptionsHint') : undefined}
          />
        }
      />

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setNote('');
          }
        }}
        title={t('months.resolveTitle')}
        description={target ? t(`months.exception.${target.type}`) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={note.trim().length < MIN_NOTE}
              loading={resolve.isPending}
              onClick={() => void submit()}
            >
              {t('months.resolveConfirm')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {target ? (
            <p className="rounded-md bg-surface-variant px-md py-sm text-body-small text-text-primary">
              {target.supplierCode ? `${target.supplierCode} · ` : ''}
              {target.detail}
            </p>
          ) : null}

          <Field label={t('common.note')} required hint={t('months.resolveNoteHint', { min: MIN_NOTE })}>
            {({ id, describedBy, invalid, required }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                autoFocus
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
