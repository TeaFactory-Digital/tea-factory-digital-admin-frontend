/**
 * Showing a full bank account number.
 *
 * §20.4: "Bank account numbers are masked in the console except to roles that
 * need them, and every unmasked view is audited." This dialog is that rule made
 * operable, and three details carry it:
 *
 *  1. **A reason is required**, because an audit entry recording *that* someone
 *     looked without recording *why* answers the wrong question.
 *  2. **The clerk is told it is being recorded, before they ask.** A control the
 *     person subject to it does not know about does not change behaviour.
 *  3. **The audit id is shown back.** That is the difference between "we log
 *     this" as a policy statement and as something visibly happening.
 *
 * The revealed number is held in this component's mutation result and dropped
 * when the dialog closes — never cached (see `useRevealBankDetails`).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { errorMessageKey } from '@/lib/errorMessage';
import { useRevealBankDetails } from './hooks';

const MIN_REASON = 10;

export function RevealBankDetailsDialog({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const reveal = useRevealBankDetails(supplierId);

  function close() {
    setOpen(false);
    setReason('');
    reveal.reset(); // drops the number
  }

  const tooShort = reason.trim().length < MIN_REASON;

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconLeft={<Eye className="size-icon-sm" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        {t('suppliers.action.reveal')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={t('suppliers.reveal.title')}
        description={t('suppliers.reveal.body')}
        footer={
          reveal.data ? (
            <Button variant="secondary" onClick={close}>
              {t('common.close')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                loading={reveal.isPending}
                disabled={tooShort}
                onClick={() => reveal.mutate(reason.trim())}
              >
                {t('suppliers.reveal.show')}
              </Button>
            </>
          )
        }
      >
        {reveal.data ? (
          <div className="flex flex-col gap-sm">
            <dl className="flex flex-col gap-xs">
              <div className="flex justify-between gap-md">
                <dt className="text-body-small text-text-secondary">
                  {t('suppliers.detail.bank')}
                </dt>
                <dd className="text-body-small text-text-primary">{reveal.data.bankName}</dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-body-small text-text-secondary">
                  {t('suppliers.detail.branch')}
                </dt>
                <dd className="text-body-small text-text-primary">{reveal.data.branchName}</dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-body-small text-text-secondary">
                  {t('suppliers.detail.accountNumber')}
                </dt>
                <dd className="numeric text-subtitle font-semibold text-text-primary">
                  {reveal.data.accountNumber}
                </dd>
              </div>
            </dl>
            <p className="text-caption text-text-secondary">
              {t('suppliers.reveal.recorded', { auditId: reveal.data.auditId })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            <Field
              label={t('suppliers.reveal.reasonLabel')}
              required
              hint={t('suppliers.reasonLabel')}
              error={reveal.error ? t(errorMessageKey(reveal.error)) : undefined}
            >
              {({ id, describedBy, invalid, required }) => (
                <Textarea
                  id={id}
                  autoFocus
                  rows={3}
                  value={reason}
                  placeholder={t('suppliers.reveal.reasonPlaceholder')}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
