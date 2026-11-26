/**
 * Ours against the slips the factory's own system printed.
 *
 * A factory whose bills are calculated here still runs its own system, and that system
 * prints a slip for every supplier. The supplier holds both, so they must agree to the
 * rupee. The office enters (or imports) each printed slip's "Balance", and this card lists
 * every bill that does not match: ours, printed, the difference.
 *
 * A bill that does not match is fixed (the leaf, the rate, an approval entered in one system
 * only), recalculated and compared again, or **held**: a held bill is left out of the
 * publish, so the supplier is never shown a figure the factory did not pay. Once it matches
 * it is released, which in a month already published publishes that one bill.
 */

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, PauseCircle, TriangleAlert } from 'lucide-react';
import { HOLD_REASON_MIN, slipComparisonBlocks, type SlipComparisonRow } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ErrorState, Notice, LinesSkeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey, errorMessageValues } from '@/lib/errorMessage';
import { formatCount, formatMoney, formatMonthKey } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useHoldBill, useReleaseBill, useSetPrinted, useSlipComparison } from './hooks';
import { ReasonChips } from '@/components/ReasonChips';
import { InfoTip } from '@/components/ui/Tooltip';

export function SlipComparisonCard({ monthKey, monthOpen }: { monthKey: string; monthOpen: boolean }) {
  const { t } = useTranslation();
  const comparison = useSlipComparison(monthKey, true);
  const canWrite = useCan('billing', 'write');
  const canRelease = useCan('ratesAndMonthClose', 'approve');
  const [holding, setHolding] = useState<SlipComparisonRow | null>(null);
  const [releasing, setReleasing] = useState<SlipComparisonRow | null>(null);

  const data = comparison.data;
  const blocking = data ? slipComparisonBlocks(data.rows) : [];

  return (
    <Card>
      <CardHeader title={t('slips.title')} description={t('slips.description')} />
      <CardBody className="flex flex-col gap-md">
        {comparison.error ? (
          <ErrorState error={comparison.error} onRetry={() => void comparison.refetch()} />
        ) : !data ? (
          <LinesSkeleton lines={4} />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-lg gap-y-xs sm:grid-cols-4">
              <Count label={t('slips.count.match')} value={data.counts.match} />
              <Count label={t('slips.count.mismatch')} value={data.counts.mismatch} alert />
              <Count label={t('slips.count.missing')} value={data.counts.missing} alert />
              <Count label={t('slips.count.held')} value={data.counts.held} />
            </dl>

            {monthOpen && blocking.length > 0 ? (
              <Notice tone="warning">
                <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('slips.blocking', { count: blocking.length })}
              </Notice>
            ) : null}
            {!monthOpen && data.counts.held > 0 ? (
              <Notice tone="info">
                <PauseCircle className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('slips.heldAfterPublish', { count: data.counts.held })}
              </Notice>
            ) : null}
            {canWrite && data.rows.some((row) => monthOpen || row.held) ? (
              <InfoTip label={t('tip.howToEnter')} text={t('tip.howToEnter')}>
                {t('slips.howToEnter')}
              </InfoTip>
            ) : null}
            {data.rows.length === 0 ? (
              <p className="flex items-start gap-xs text-body-small text-success">
                <CheckCircle2 className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('slips.allMatch')}
              </p>
            ) : (
              <div className="relative max-h-96 overflow-auto rounded-md border border-border">
                <table className="w-full border-collapse text-data-cell" aria-label={t('slips.title')}>
                  <thead className="sticky top-0 bg-table-header">
                    <tr>
                      <Th>{t('slips.col.supplier')}</Th>
                      <Th right>{t('slips.col.ours')}</Th>
                      <Th right>{t('slips.col.printed')}</Th>
                      <Th right>{t('slips.col.difference')}</Th>
                      <Th>{t('slips.col.status')}</Th>
                      <Th right>
                        <span className="sr-only">{t('slips.col.actions')}</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, index) => {
                      // A held bill in a published month is still open; any other bill there is the record.
                      const editable = monthOpen || row.held;
                      return (
                        <tr
                          key={row.billId}
                          className={cn('border-t border-divider', index % 2 === 1 && 'bg-table-row-alt')}
                        >
                          <td className="px-md py-sm">
                            <Link to={`/bills/${row.billId}`} className="font-medium text-primary hover:underline">
                              {row.supplierCode}
                            </Link>{' '}
                            <span className="text-text-primary">{row.supplierName}</span>
                            {row.holdReason || row.heldForMonth ? (
                              <p className="text-caption text-text-secondary">
                                {row.holdReason ??
                                  t('slips.heldForEarlier', { month: formatMonthKey(row.heldForMonth!) })}
                              </p>
                            ) : null}
                          </td>
                          <td className="numeric px-md py-sm text-right text-text-primary">
                            {row.ours === null ? '-' : formatMoney(row.ours)}
                          </td>
                          <td className="numeric px-md py-xs text-right text-text-primary">
                            {/* Typed in place: Enter saves and moves to the next slip, so a stack
                                of printed slips goes in without a dialog per bill. */}
                            {canWrite && editable ? (
                              <PrintedCell row={row} nextBillId={data.rows[index + 1]?.billId} />
                            ) : row.printed === null ? (
                              '-'
                            ) : (
                              formatMoney(row.printed)
                            )}
                          </td>
                          <td
                            className={cn(
                              'numeric px-md py-sm text-right font-medium',
                              row.difference ? 'text-error' : 'text-text-secondary',
                            )}
                          >
                            {row.difference === null ? '-' : formatMoney(row.difference)}
                          </td>
                          <td className="px-md py-sm">
                            <div className="flex flex-wrap gap-xs">
                              <Badge
                                tone={row.status === 'match' ? 'success' : row.status === 'mismatch' ? 'error' : 'warning'}
                              >
                                {t(`slips.status.${row.status}`)}
                              </Badge>
                              {row.held ? <Badge tone="info">{t('slips.status.held')}</Badge> : null}
                            </div>
                          </td>
                          <td className="px-md py-sm">
                            <div className="flex flex-wrap justify-end gap-xs">
                              {canWrite && monthOpen && !row.held ? (
                                <Button size="sm" variant="secondary" onClick={() => setHolding(row)}>
                                  {t('slips.hold')}
                                </Button>
                              ) : null}
                              {canRelease && row.held && row.status === 'match' ? (
                                <Button size="sm" variant="primary" onClick={() => setReleasing(row)}>
                                  {t('slips.release')}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <InfoTip label={t('tip.howToFix')} text={t('tip.howToFix')}>
              {t('slips.howToFix')}
            </InfoTip>
          </>
        )}
      </CardBody>

      {holding ? <HoldDialog row={holding} onClose={() => setHolding(null)} /> : null}
      {releasing ? (
        <ReleaseDialog row={releasing} monthOpen={monthOpen} onClose={() => setReleasing(null)} />
      ) : null}
    </Card>
  );
}

function Count({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-text-secondary">{label}</dt>
      <dd className={cn('numeric text-subtitle', alert && value > 0 ? 'text-error' : 'text-text-primary')}>
        {formatCount(value)}
      </dd>
    </div>
  );
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={cn('px-md py-sm text-data-header text-text-secondary', right ? 'text-right' : 'text-left')}>
      {children}
    </th>
  );
}

/**
 * One printed slip's Balance, typed in its row. Enter (or leaving the field) saves it when
 * it changed, and Enter moves the caret to the next slip's field. Whole rupees, 0 or more
 * (decided 10 November 2026); empty clears it. A row that now matches leaves the list, so
 * the next field is found by its bill, not its position.
 */
function PrintedCell({ row, nextBillId }: { row: SlipComparisonRow; nextBillId?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSetPrinted();
  const saved = row.printed === null ? '' : String(row.printed);
  const [value, setValue] = useState(saved);
  const amount = value.trim() === '' ? null : Number(value.replace(/,/g, ''));
  const invalid = amount !== null && !(Number.isInteger(amount) && amount >= 0);

  async function commit(moveOn: boolean) {
    const focusNext = () => {
      if (!moveOn || !nextBillId) return;
      document.querySelector<HTMLInputElement>(`input[data-printed-bill="${nextBillId}"]`)?.focus();
    };
    if (invalid || value === saved) {
      if (!invalid) focusNext();
      return;
    }
    try {
      await save.mutateAsync([row.billId, amount]);
      focusNext();
    } catch (error) {
      toast.error(t('slips.failed'), t(errorMessageKey(error), errorMessageValues(error)));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit(true);
    } else if (event.key === 'Escape') {
      setValue(saved);
    }
  }

  return (
    <Input
      data-printed-bill={row.billId}
      aria-label={t('slips.printedFor', { code: row.supplierCode })}
      title={invalid ? t('slips.printedInvalid') : undefined}
      invalid={invalid}
      inputMode="numeric"
      autoComplete="off"
      className="numeric ml-auto w-32 text-right"
      placeholder="-"
      disabled={save.isPending}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => void commit(false)}
    />
  );
}

function HoldDialog({ row, onClose }: { row: SlipComparisonRow; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const hold = useHoldBill();
  const [reason, setReason] = useState('');
  const short = reason.trim().length < HOLD_REASON_MIN;

  async function submit() {
    try {
      await hold.mutateAsync([row.billId, reason]);
      toast.success(t('slips.heldToast', { code: row.supplierCode }));
      onClose();
    } catch (error) {
      toast.error(t('slips.failed'), t(errorMessageKey(error), errorMessageValues(error)));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('slips.holdTitle', { code: row.supplierCode, name: row.supplierName })}
      description={t('slips.holdBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={short} loading={hold.isPending} onClick={() => void submit()}>
            {t('slips.hold')}
          </Button>
        </>
      }
    >
      <Field label={t('slips.holdReason')} required hint={t('slips.holdReasonHint', { min: HOLD_REASON_MIN })}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            rows={2}
            autoFocus
            value={reason}
            placeholder={t('slips.holdPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
      <ReasonChips list="bills.hold" value={reason} onChange={setReason} />
    </Dialog>
  );
}

function ReleaseDialog({
  row,
  monthOpen,
  onClose,
}: {
  row: SlipComparisonRow;
  monthOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const release = useReleaseBill();

  async function confirm() {
    try {
      const result = await release.mutateAsync([row.billId]);
      toast.success(
        result.published
          ? t('slips.releasedPublished', { code: row.supplierCode })
          : t('slips.released', { code: row.supplierCode }),
      );
    } catch (error) {
      toast.error(t('slips.failed'), t(errorMessageKey(error), errorMessageValues(error)));
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('slips.releaseTitle', { code: row.supplierCode, name: row.supplierName })}
      description={monthOpen ? t('slips.releaseBodyOpen') : t('slips.releaseBodyPublished')}
      confirmLabel={t('slips.release')}
      loading={release.isPending}
      onConfirm={confirm}
    />
  );
}
