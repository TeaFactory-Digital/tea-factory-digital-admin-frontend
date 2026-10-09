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
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { useAdjustBill } from '@/modules/records/hooks';

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
            <Input id={id} invalid={invalid} inputMode="decimal" className="numeric" autoFocus value={value} onChange={(event) => setValue(event.target.value)} />
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
      </div>
    </Dialog>
  );
}
