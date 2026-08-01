/**
 * Withdrawing a delivery.
 *
 * A void, never a delete (§12.1). The row stays with who withdrew it and why,
 * because a weighing that existed and then did not is something the supplier —
 * holding the slip from the counter — will ask about, and "voided on the 14th"
 * with no reason is a conversation nobody in the office can have.
 *
 * The reason is checked before the request goes out *and* refused by the server
 * (`422 note-required`). Both, deliberately: the client check is for the clerk's
 * benefit, and the server's is the one that is actually enforced.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Delivery } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatKg } from '@/lib/format';
import { useVoidDelivery } from './hooks';

const MIN_REASON = 10;

export function VoidDeliveryDialog({
  delivery,
  onClose,
}: {
  /** `null` closes the dialog — the caller holds the row being voided. */
  delivery: Delivery | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const voidDelivery = useVoidDelivery();
  const [reason, setReason] = useState('');

  const tooShort = reason.trim().length < MIN_REASON;

  async function submit() {
    if (!delivery) return;
    try {
      await voidDelivery.mutateAsync({ id: delivery.id, reason: reason.trim() });
      toast.success(t('deliveries.voided', { kgs: formatKg(delivery.kgs) }));
      setReason('');
      onClose();
    } catch (cause) {
      // Kept open on failure: a `month-locked` refusal is information the clerk
      // needs while looking at the row, not a toast over a closed dialog.
      toast.error(t('deliveries.voidFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Dialog
      open={delivery !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason('');
          onClose();
        }
      }}
      title={t('deliveries.voidTitle')}
      description={
        delivery
          ? t('deliveries.voidDescription', {
              kgs: formatKg(delivery.kgs),
              code: delivery.supplierCode,
              name: delivery.supplierName,
            })
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={tooShort}
            loading={voidDelivery.isPending}
            onClick={() => void submit()}
          >
            {t('deliveries.voidConfirm')}
          </Button>
        </>
      }
    >
      <Field
        label={t('common.reason')}
        required
        hint={t('deliveries.voidReasonHint', { min: MIN_REASON })}
      >
        {({ id, describedBy, invalid, required }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
    </Dialog>
  );
}
