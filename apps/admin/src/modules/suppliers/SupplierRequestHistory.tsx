/**
 * Everything one supplier has asked the factory for: advances, loans, manure and tea
 * packets, in every status, newest first. The office opens it to answer "what has this
 * supplier had from us", which no queue can, because each queue shows one status at a time
 * across every supplier.
 *
 * Read only. Deciding stays in the queues; a credit row opens its request.
 *
 * Totals count **approved** requests only: a rejected advance was never paid, and a
 * pending one may not be.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Banknote, Coffee, HandCoins, Leaf } from 'lucide-react';
import type { CreditFacility, RequestStatus } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { isApiError } from '@/services/api/errors';
import { cn } from '@/lib/cn';
import { formatCount, formatDate, formatMoney } from '@/lib/format';
import { useSupplierRequestHistory } from './hooks';

type Kind = CreditFacility | 'teaPackets';
type Filter = 'all' | Kind;

const KINDS: Kind[] = ['advance', 'loan', 'manure', 'teaPackets'];
const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;
const KIND_ICONS = { advance: Banknote, loan: HandCoins, manure: Leaf, teaPackets: Coffee };

interface Row {
  id: string;
  kind: Kind;
  createdAt: string;
  status: RequestStatus;
  amount: number;
  detail: string;
  /** Credit requests have a page of their own; tea packets are decided in their queue. */
  to: string | null;
}

export function SupplierRequestHistory({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();
  const history = useSupplierRequestHistory(supplierId);
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo<Row[]>(() => {
    const credit: Row[] = history.credit.map((request) => ({
      id: request.id,
      kind: request.facility,
      createdAt: request.createdAt,
      status: request.status,
      amount: request.amount,
      detail:
        request.facility === 'manure'
          ? [
              request.manureType,
              request.quantityKg ? `${formatCount(request.quantityKg)} kg` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : request.repaymentMonths
            ? t('suppliers.requestHistory.months', { count: request.repaymentMonths })
            : (request.reason ?? ''),
      to: `/credit/${request.id}`,
    }));
    const tea: Row[] = history.teaPackets.map((request) => ({
      id: request.id,
      kind: 'teaPackets',
      createdAt: request.createdAt,
      status: request.status,
      amount: request.amount,
      detail: `${t('suppliers.requestHistory.packets', { count: request.packets })} · ${t(
        `teaPackets.delivery.${request.deliveryMethod}`,
      )}`,
      to: null,
    }));
    return [...credit, ...tea].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [history.credit, history.teaPackets, t]);

  const totals = useMemo(
    () =>
      KINDS.map((kind) => {
        const approved = rows.filter((row) => row.kind === kind && row.status === 'approved');
        return {
          kind,
          count: approved.length,
          amount: approved.reduce((sum, row) => sum + row.amount, 0),
          pending: rows.filter((row) => row.kind === kind && row.status === 'pending').length,
        };
      }),
    [rows],
  );

  const shown = filter === 'all' ? rows : rows.filter((row) => row.kind === filter);

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={t('suppliers.requestHistory.title')}
        description={t('suppliers.requestHistory.hint')}
      />
      <CardBody className="flex flex-col gap-md">
        {history.isPending ? (
          <Skeleton className="h-48" />
        ) : isApiError(history.error) && history.error.code === 'forbidden' ? (
          // The screen hides this tab from roles without `creditRequests: R`; this is for a
          // grant withdrawn while the page was open.
          <Notice tone="info">{t('suppliers.requestHistory.forbidden')}</Notice>
        ) : history.error ? (
          <ErrorState error={history.error} onRetry={history.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('suppliers.requestHistory.empty')}
            body={t('suppliers.requestHistory.emptyHint')}
          />
        ) : (
          <>
            {/* Approved totals per kind; each tile also filters the list to its kind. */}
            <div className="grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
              {totals.map((total) => {
                const Icon = KIND_ICONS[total.kind];
                const active = filter === total.kind;
                return (
                  <button
                    key={total.kind}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(active ? 'all' : total.kind)}
                    className={cn(
                      'flex items-start gap-sm rounded-md border p-md text-left transition-colors',
                      active
                        ? 'border-primary bg-primary-muted'
                        : 'border-border bg-surface hover:bg-surface-variant',
                    )}
                  >
                    <Icon className="mt-xxs size-icon-md shrink-0 text-primary" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-caption text-text-secondary">
                        {t(`suppliers.requestHistory.kind.${total.kind}`)}
                      </span>
                      <span className="numeric text-subtitle text-text-primary">
                        {formatMoney(total.amount)}
                      </span>
                      <span className="text-caption text-text-secondary">
                        {t('suppliers.requestHistory.approvedCount', { count: total.count })}
                        {total.pending > 0
                          ? ` · ${t('suppliers.requestHistory.pendingCount', { count: total.pending })}`
                          : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {shown.length === 0 ? (
              <p className="text-body-small text-text-secondary">
                {t('suppliers.requestHistory.noneOfKind')}
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border border-border">
                <table
                  className="w-full border-collapse text-data-cell"
                  aria-label={t('suppliers.requestHistory.title')}
                >
                  <thead className="sticky top-0 bg-table-header">
                    <tr>
                      {[
                        ['date', 'text-left'],
                        ['type', 'text-left'],
                        ['details', 'text-left'],
                        ['amount', 'text-right'],
                        ['status', 'text-left'],
                      ].map(([key, align]) => (
                        <th
                          key={key}
                          scope="col"
                          className={cn('px-md py-sm text-data-header text-text-secondary', align)}
                        >
                          {t(`suppliers.requestHistory.column.${key}`)}
                        </th>
                      ))}
                      <th className="w-10" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row, index) => (
                      <tr
                        key={`${row.kind}-${row.id}`}
                        className={cn(
                          'border-t border-divider',
                          index % 2 === 1 && 'bg-table-row-alt',
                        )}
                      >
                        <td className="px-md py-sm whitespace-nowrap text-text-primary">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-md py-sm whitespace-nowrap">
                          {t(`suppliers.requestHistory.kind.${row.kind}`)}
                        </td>
                        <td className="px-md py-sm text-text-secondary">{row.detail}</td>
                        <td className="numeric px-md py-sm text-right">
                          {formatMoney(row.amount)}
                        </td>
                        <td className="px-md py-sm">
                          <Badge tone={STATUS_TONES[row.status]}>
                            {t(`credit.status.${row.status}`)}
                          </Badge>
                        </td>
                        <td className="px-xs py-sm">
                          {row.to ? (
                            <Link
                              to={row.to}
                              aria-label={t('suppliers.requestHistory.open')}
                              className="inline-flex rounded-md p-xs text-primary hover:bg-surface-variant"
                            >
                              <ArrowUpRight className="size-icon-sm" aria-hidden />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
