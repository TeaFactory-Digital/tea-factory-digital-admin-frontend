/**
 * Recording what the bank or the counter actually did.
 *
 * This is the half of a payout that systems leave out and offices therefore do on
 * paper: money is released, some of it bounces, and somebody has to know which. The
 * dialog is built around that asymmetry —
 *
 *  - **Paid** needs nothing but a confirmation. It explains itself.
 *  - **Failed** needs a reason, and the reason is the point: the supplier has not been
 *    paid, and the next person to pick the run up works entirely from that note. It is
 *    refused under the field, in the schema, and by the server (`note-required`) —
 *    the same three layers AC-06 puts behind a rejection note.
 *
 * The amount is repeated in the dialog because this is a confirmation about money, and
 * a confirmation that only says "are you sure" is a click rather than a check.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PayoutLine } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatMoney } from '@/lib/format';
import { useMarkPayoutLine } from './hooks';

const MIN_REASON = 10;

export function MarkPayoutLineDialog({
  runId,
  line,
  intent,
  onClose,
}: {
  runId: string;
  line: PayoutLine | null;
  intent: 'paid' | 'failed';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const mark = useMarkPayoutLine(runId);

  const [reason, setReason] = useState('');

  // The field follows the line, not the mount: a reason typed for one supplier must
  // not still be in the box when the next line is opened.
  useEffect(() => {
    setReason('');
  }, [line?.id, intent]);

  const blocked = intent === 'failed' && reason.trim().length < MIN_REASON;

  async function submit() {
    if (!line) return;
    try {
      await mark.mutateAsync({
        lineId: line.id,
        status: intent,
        reason: intent === 'failed' ? reason.trim() : undefined,
      });
      toast.success(
        intent === 'paid'
          ? t('payouts.markedPaid', { code: line.supplierCode })
          : t('payouts.markedFailed', { code: line.supplierCode }),
      );
      onClose();
    } catch (cause) {
      // The dialog stays open: `run-not-approved` or `line-not-payable` is
      // information about what to do next, not a toast over a closed dialog.
      toast.error(t('payouts.markFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Dialog
      open={line !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={intent === 'paid' ? t('payouts.markPaidTitle') : t('payouts.markFailedTitle')}
      description={
        intent === 'paid' ? t('payouts.markPaidBody') : t('payouts.markFailedBody')
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={intent === 'failed' ? 'danger' : 'primary'}
            disabled={blocked}
            loading={mark.isPending}
            onClick={() => void submit()}
          >
            {intent === 'paid' ? t('payouts.confirmPaid') : t('payouts.confirmFailed')}
          </Button>
        </>
      }
    >
      {line ? (
        <div className="flex flex-col gap-md">
          {/* The figures, repeated. */}
          <dl className="flex flex-col gap-xs rounded-md bg-surface-variant px-md py-sm text-body-small">
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('payouts.column.supplier')}</dt>
              <dd className="numeric font-semibold text-text-primary">
                {line.supplierCode} · {line.supplierName}
              </dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('payouts.column.amount')}</dt>
              <dd className="numeric font-semibold text-text-primary">
                {formatMoney(line.amount)}
              </dd>
            </div>
            {line.accountNumber ? (
              <div className="flex justify-between gap-md">
                <dt className="text-text-secondary">{t('suppliers.detail.accountNumber')}</dt>
                {/* Masked, as it arrived (§20.4). The full number is M2's audited
                    reveal, never a value a reconciliation screen carries. */}
                <dd className="numeric text-text-primary">
                  {line.bankName} · {line.accountNumber}
                </dd>
              </div>
            ) : null}
          </dl>

          {intent === 'failed' ? (
            <Field
              label={t('payouts.reasonLabel')}
              required
              hint={t('payouts.reasonHint', { min: MIN_REASON })}
            >
              {({ id, describedBy, invalid, required }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  autoFocus
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </Field>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
