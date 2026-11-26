/**
 * The bill's "other deductions" line, the one line the office types.
 *
 * Only while the factory-system sync is off (the console calculated the bill) and before
 * the month is published. The reason is required for any amount, because the supplier reads
 * it under the line in the app and would otherwise ring the office to ask.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { billAdjustmentProblem } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { useAdjustBill } from '@/modules/records/hooks';
import { ReasonChips } from '@/components/ReasonChips';
import { ErrorState, Notice, LinesSkeleton } from '@/components/ui/states';
import { useBill } from './hooks';

export function OtherChargesDialog({
  billId,
  amount,
  note: initialNote,
  onClose,
}: {
  billId: string;
  amount: number;
  note: string | null | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const adjust = useAdjustBill(billId);
  const [value, setValue] = useState(String(amount));
  const [note, setNote] = useState(initialNote ?? '');

  const body = { otherCards: value.trim() === '' ? NaN : Number(value), otherCardsNote: note.trim() };
  const problem = billAdjustmentProblem(body);

  async function submit() {
    try {
      await adjust.mutateAsync(body);
      toast.success(t('records.otherCharges.saved'), t('records.otherCharges.savedHint'));
      onClose();
    } catch (error) {
      toast.error(t('records.otherCharges.failed'), t(errorMessageKey(error)));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('records.otherCharges.title')}
      description={t('records.otherCharges.body')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={problem !== null} loading={adjust.isPending} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Field
          label={t('records.otherCharges.amount')}
          required
          error={problem === 'negative' && value !== '' ? t('records.otherCharges.amountInvalid') : undefined}
        >
          {({ id, invalid }) => (
            <MoneyInput id={id} invalid={invalid}  autoFocus value={value} onValueChange={setValue} />
          )}
        </Field>
        <Field
          label={t('records.otherCharges.note')}
          required={body.otherCards > 0}
          hint={t('records.otherCharges.noteHint')}
          error={problem === 'note-required' && note !== '' ? t('records.otherCharges.noteRequired') : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={2} value={note} placeholder={t('records.otherCharges.notePlaceholder')} onChange={(event) => setNote(event.target.value)} />
          )}
        </Field>
        <ReasonChips list="bills.otherDeductions" value={note} onChange={setNote} />
      </div>
    </Dialog>
  );
}

/**
 * The same dialog opened from a row of the bills list (22 November 2026), so a month's other
 * deductions are typed down the list without opening each bill. The row carries no figures for
 * the line, so the bill is read first; a bill imported from the factory's slip is corrected
 * there and re-imported, and says so instead of opening.
 */
export function OtherChargesFromList({ billId, onClose }: { billId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const bill = useBill(billId);
  const data = bill.data;
  if (bill.error) {
    return (
      <Dialog open onOpenChange={(next) => (next ? undefined : onClose())} title={t('records.otherCharges.title')}>
        <ErrorState error={bill.error} onRetry={() => void bill.refetch()} />
      </Dialog>
    );
  }
  if (!data) {
    return (
      <Dialog open onOpenChange={(next) => (next ? undefined : onClose())} title={t('records.otherCharges.title')}>
        <LinesSkeleton lines={3} />
      </Dialog>
    );
  }
  if (data.source === 'imported' || data.publishedAt !== null) {
    return (
      <Dialog
        open
        onOpenChange={(next) => (next ? undefined : onClose())}
        title={t('records.otherCharges.title')}
        footer={<Button onClick={onClose}>{t('common.close')}</Button>}
      >
        <Notice tone="info">
          {data.publishedAt !== null ? t('bills.correctionsPublished') : t('records.otherCharges.imported')}
        </Notice>
      </Dialog>
    );
  }
  return <OtherChargesDialog billId={data.id} amount={data.deductions.otherCards} note={data.otherCardsNote} onClose={onClose} />;
}
