/**
 * Issuing a supplier a new app password (§21.15, §21.16).
 *
 * The factory's answer: generate one at random and hand it over at the counter. Right for
 * this factory — a fifth of suppliers have no email, there is no SMS gateway, and the office
 * knows these people by face. But it has one dangerous property, and this dialog is built
 * around it:
 *
 * > **The office learns the password.** Whoever clicks the button could sign in as that
 * > supplier and raise a change request *as them*.
 *
 * So the dialog does three things a plainer one would not:
 *
 *  1. **Says the credential is one-time**, because that is what makes it safe — the supplier
 *     must replace it at first sign-in, and until the office believes that, they will treat
 *     a password they know as a password they may keep using.
 *  2. **Asks how identity was checked**, not "why". The distinction matters: a clerk typing
 *     *"came to the counter with book 5091"* has done the check; one typing *"reset"* has
 *     not, and the field is the moment they notice.
 *  3. **Shows the password once**, and says so before it is dismissed. Closing means
 *     generating another — which is correct, and infuriating if it is a surprise.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { IDENTITY_CHECK_MIN, formatSupplierPassword, type SupplierCredentialReset } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useResetSupplierCredentials } from './hooks';

export function ResetPasswordDialog({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const reset = useResetSupplierCredentials(supplierId);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [issued, setIssued] = useState<SupplierCredentialReset | null>(null);

  function close() {
    setOpen(false);
    setReason('');
    // Cleared on close, deliberately: a password left in component state is a password a
    // re-opened dialog would show to whoever is at the desk next.
    setIssued(null);
  }

  async function submit() {
    try {
      setIssued(await reset.mutateAsync(reason.trim()));
    } catch (cause) {
      toast.error(t('suppliers.resetPassword.failed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        iconLeft={<KeyRound className="size-icon-sm" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        {t('suppliers.action.resetPassword')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title={t('suppliers.resetPassword.title')}
        description={
          issued
            ? t('suppliers.resetPassword.issuedBody')
            : t('suppliers.resetPassword.body', { name: supplierName })
        }
        footer={
          issued ? (
            <Button variant="primary" onClick={close}>
              {t('suppliers.resetPassword.done')}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={reason.trim().length < IDENTITY_CHECK_MIN}
                loading={reset.isPending}
                onClick={() => void submit()}
              >
                {t('suppliers.resetPassword.confirm')}
              </Button>
            </>
          )
        }
      >
        {issued ? (
          <div className="flex flex-col gap-md">
            {/* Shown once. Large, grouped and selectable — it is about to be copied onto a
                slip of paper by hand. */}
            <p
              className="numeric select-all rounded-md bg-surface-variant px-lg py-md text-center text-h3 tracking-widest text-text-primary"
              aria-label={t('suppliers.resetPassword.passwordLabel')}
            >
              {formatSupplierPassword(issued.password)}
            </p>

            <p className="rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
              {t('suppliers.resetPassword.onceWarning')}
            </p>

            {/* The property that makes this safe, stated to the person who now knows the
                password. */}
            <p className="text-body-small text-text-secondary">
              {t('suppliers.resetPassword.oneTime')}
            </p>

            <p className="text-caption text-text-secondary">
              {t('suppliers.resetPassword.recorded', {
                name: issued.issuedByName,
                when: formatDateTime(issued.issuedAt),
                audit: issued.auditId,
              })}
              {issued.sessionsEnded > 0
                ? ` ${t('suppliers.resetPassword.sessionsEnded', { count: issued.sessionsEnded })}`
                : ''}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            <p className="rounded-md bg-surface-variant px-md py-sm text-body-small text-text-primary">
              {t('suppliers.resetPassword.beforeYouStart')}
            </p>

            <Field
              label={t('suppliers.resetPassword.identityCheck')}
              required
              hint={t('suppliers.resetPassword.identityCheckHint', { min: IDENTITY_CHECK_MIN })}
            >
              {({ id, describedBy, required }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  required={required}
                  autoFocus
                  rows={3}
                  placeholder={t('suppliers.resetPassword.identityCheckPlaceholder')}
                  value={reason}
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
