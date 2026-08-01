/**
 * One payout run: release it, then reconcile it.
 *
 * Two jobs on one screen because they belong to two people and happen in order. The
 * manager releases the run — `payouts: A`, which §12.1 withholds from the accountant
 * who prepared it, and which BR-501 withholds even from a manager who prepared it
 * themselves. Then whoever is sitting with the bank's response works the lines.
 *
 * The line grid is ordered **held, failed, pending, paid**, which is the order the run
 * gets worked in rather than the order it was built in: a held line needs a passbook
 * collected before anything can move, and burying it under fifty paid rows is how a
 * supplier goes a month without being paid.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Ban, Check, Lock } from 'lucide-react';
import type { PayoutLine, PayoutLineQuery, PayoutLineStatus } from '@tfd/domain';
import { useAuthStore, useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatCount, formatDateTime, formatMoney, formatMonthKey } from '@/lib/format';
import { MarkPayoutLineDialog } from './MarkPayoutLineDialog';
import { LINE_TONES, RUN_TONES } from './tones';
import { useApprovePayoutRun, usePayoutLines, usePayoutRun } from './hooks';

export function PayoutRunDetailScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();

  const canApprove = useCan('payouts', 'approve');
  const canMark = useCan('payouts', 'write');
  const userId = useAuthStore((s) => s.user?.id);

  const [status, setStatus] = useState<PayoutLineStatus | 'all'>('all');
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [marking, setMarking] = useState<{ line: PayoutLine; intent: 'paid' | 'failed' } | null>(
    null,
  );

  const run = usePayoutRun(id);
  const approve = useApprovePayoutRun(id ?? '');

  const query = useMemo<PayoutLineQuery>(
    () => ({ status: status === 'all' ? undefined : status, page: 0, pageSize: 200 }),
    [status],
  );
  const lines = usePayoutLines(id, query);

  const columns = useMemo<ColumnDef<PayoutLine, unknown>[]>(
    () => [
      {
        accessorKey: 'supplierCode',
        header: t('payouts.column.supplier'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <Link
                to={`/suppliers/${row.supplierId}`}
                className="numeric font-semibold text-primary underline-offset-2 hover:underline"
              >
                {row.supplierCode}
              </Link>
              <span className="text-caption text-text-secondary">{row.supplierName}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: t('payouts.column.amount'),
        enableSorting: false,
        cell: (info) => (
          <span className="numeric font-semibold text-text-primary">
            {formatMoney(info.getValue<number>())}
          </span>
        ),
      },
      {
        id: 'account',
        header: t('payouts.column.account'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!row.accountNumber) {
            return <span className="text-warning">{t('suppliers.noBankDetails')}</span>;
          }
          return (
            <span className="flex flex-col">
              {/* Masked, as it arrived from the server (§20.4). A run is a list of
                  payments, not a place full-account numbers are handed out. */}
              <span className="numeric text-text-primary">{row.accountNumber}</span>
              <span className="text-caption text-text-secondary">
                {row.bankName} · {row.branchName}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col gap-xxs">
              <Badge tone={LINE_TONES[row.status]}>{t(`payouts.line.${row.status}`)}</Badge>
              {row.reason ? (
                <span className="text-caption text-text-secondary">{row.reason}</span>
              ) : null}
              {row.paidAt ? (
                <span className="numeric text-caption text-text-secondary">
                  {formatDateTime(row.paidAt)} · {row.markedByName}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('common.actions'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          const released = run.data?.status !== 'draft';

          /**
           * Nothing to offer on a line that cannot move.
           *
           * A held line has no account to pay into and a paid line is done — and in
           * both cases the server refuses with `line-not-payable`, so a button here
           * would be a lever that 403s. The *reason* is already in the status cell,
           * which is where somebody can act on it.
           */
          if (!canMark || !released || row.status === 'held' || row.status === 'paid') return null;

          return (
            <span className="flex items-center gap-xs">
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Check className="size-icon-sm" aria-hidden />}
                onClick={() => setMarking({ line: row, intent: 'paid' })}
              >
                {t('payouts.markPaid')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                iconLeft={<Ban className="size-icon-sm" aria-hidden />}
                onClick={() => setMarking({ line: row, intent: 'failed' })}
              >
                {t('payouts.markFailedShort')}
              </Button>
            </span>
          );
        },
      },
    ],
    [t, canMark, run.data?.status],
  );

  if (run.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (run.error || !run.data) {
    return <ErrorState error={run.error} onRetry={() => void run.refetch()} />;
  }

  const data = run.data;
  /**
   * The four-eyes check, run in the console so the manager is told *before* they
   * commit to a dialog. The server refuses regardless (BR-501) — the console can be
   * lied to about who prepared a run.
   */
  const wouldBeSelfApproval = Boolean(userId && data.createdById === userId);
  const nothingToRelease = data.payableCount === 0;

  async function submitApproval() {
    try {
      await approve.mutateAsync(note.trim() || undefined);
      setConfirming(false);
      setNote('');
      toast.success(t('payouts.approved', { total: formatMoney(data.totalAmount) }));
    } catch (cause) {
      toast.error(t('payouts.approveFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to={`/payouts?month=${data.monthKey}`}
            className="inline-flex items-center gap-xxs text-primary underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-icon-xs" aria-hidden />
            {t('payouts.backToMonth', { month: formatMonthKey(data.monthKey) })}
          </Link>
        }
        title={t('payouts.runTitle', {
          method: t(`suppliers.payment.${data.method}`),
          month: formatMonthKey(data.monthKey),
        })}
        description={t('payouts.runSubtitle', {
          lines: formatCount(data.payableCount),
          total: formatMoney(data.totalAmount),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            <Figure label={t('payouts.column.total')} value={formatMoney(data.totalAmount)} strong />
            <Figure label={t('payouts.monthPaid')} value={formatMoney(data.paidAmount)} />
            <Badge tone={RUN_TONES[data.status]}>{t(`payouts.status.${data.status}`)}</Badge>
          </div>
        }
      />

      <Card>
        <CardHeader
          title={t('payouts.releaseTitle')}
          description={
            data.status === 'draft' ? t('payouts.releaseDescription') : t('payouts.releasedDescription')
          }
        />
        <CardBody className="flex flex-col gap-md">
          <dl className="grid grid-cols-2 gap-x-lg gap-y-xs sm:grid-cols-4">
            <Stat label={t('payouts.stat.payable')} value={formatCount(data.payableCount)} />
            <Stat label={t('payouts.stat.paid')} value={formatCount(data.paidCount)} />
            <Stat label={t('payouts.stat.failed')} value={formatCount(data.failedCount)} />
            <Stat label={t('payouts.stat.held')} value={formatCount(data.heldCount)} />
          </dl>

          {/* Held lines are stated here, not only counted: each one is a supplier who
              will not be paid by this method until the office collects a passbook. */}
          {data.heldCount > 0 ? (
            <p className="rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
              {t('payouts.heldExplanation', { count: data.heldCount })}
            </p>
          ) : null}

          <p className="text-caption text-text-secondary">
            {t('payouts.preparedBy', {
              name: data.createdByName,
              when: formatDateTime(data.createdAt),
            })}
            {data.approvedByName
              ? ` · ${t('payouts.releasedBy', {
                  name: data.approvedByName,
                  when: formatDateTime(data.approvedAt),
                })}`
              : ''}
          </p>

          {data.status !== 'draft' ? (
            <p className="flex items-start gap-xs rounded-md bg-surface-variant px-md py-sm text-body-small text-text-secondary">
              <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
              {data.status === 'completed'
                ? t('payouts.completedNotice', { when: formatDateTime(data.completedAt) })
                : t('payouts.approvedNotice')}
            </p>
          ) : canApprove ? (
            <div className="flex flex-col gap-xs border-t border-divider pt-md">
              <Button
                variant="primary"
                disabled={wouldBeSelfApproval || nothingToRelease}
                onClick={() => setConfirming(true)}
              >
                {t('payouts.release', { total: formatMoney(data.totalAmount) })}
              </Button>
              {/* The reason it is disabled, in words, next to the control. */}
              {wouldBeSelfApproval ? (
                <p className="text-caption text-warning">{t('payouts.fourEyesHint')}</p>
              ) : nothingToRelease ? (
                <p className="text-caption text-warning">{t('payouts.nothingPayableHint')}</p>
              ) : (
                <p className="text-caption text-text-secondary">{t('payouts.releaseHint')}</p>
              )}
            </div>
          ) : (
            <p className="border-t border-divider pt-md text-caption text-text-secondary">
              {t('payouts.releaseNeedsManager')}
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader
          title={t('payouts.linesTitle')}
          description={t('payouts.linesDescription')}
          className="shrink-0"
          actions={
            <Select
              aria-label={t('payouts.filterLines')}
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              fullWidth={false}
            >
              <option value="all">{t('payouts.filter.all')}</option>
              <option value="held">{t('payouts.filter.held', { count: data.heldCount })}</option>
              <option value="pending">{t('payouts.filter.pending')}</option>
              <option value="failed">{t('payouts.filter.failed')}</option>
              <option value="paid">{t('payouts.filter.paid')}</option>
            </Select>
          }
        />

        <DataTable
          label={t('payouts.linesTitle')}
          columns={columns}
          page={lines.data}
          loading={lines.isPending}
          error={lines.error}
          onRetry={() => void lines.refetch()}
          getRowId={(row) => row.id}
          // The whole run comes back in one page: a run is read as one list, and the
          // filter above is what narrows it.
          onPageChange={() => {}}
          emptyState={<EmptyState title={t('common.noResults')} body={t('payouts.noLinesHint')} />}
        />
      </Card>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(false);
        }}
        title={t('payouts.confirmReleaseTitle')}
        description={t('payouts.confirmReleaseBody')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={approve.isPending} onClick={() => void submitApproval()}>
              {t('payouts.confirmRelease')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {/* The figures, repeated: this is money about to leave the factory. */}
          <dl className="flex flex-col gap-xs rounded-md bg-surface-variant px-md py-sm text-body-small">
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('payouts.method')}</dt>
              <dd className="font-semibold text-text-primary">
                {t(`suppliers.payment.${data.method}`)}
              </dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('payouts.stat.payable')}</dt>
              <dd className="numeric text-text-primary">{formatCount(data.payableCount)}</dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('payouts.column.total')}</dt>
              <dd className="numeric font-semibold text-text-primary">
                {formatMoney(data.totalAmount)}
              </dd>
            </div>
          </dl>

          <Field label={t('common.note')} hint={t('payouts.releaseNoteHint')}>
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Dialog>

      <MarkPayoutLineDialog
        runId={id ?? ''}
        line={marking?.line ?? null}
        intent={marking?.intent ?? 'paid'}
        onClose={() => setMarking(null)}
      />
    </>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-text-secondary">{label}</dt>
      <dd className="numeric text-subtitle text-text-primary">{value}</dd>
    </div>
  );
}
