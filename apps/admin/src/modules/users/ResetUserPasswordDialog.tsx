/**
 * A colleague forgot their console password (BACKEND-TODO #37).
 *
 * There is no mail sender, so a "we emailed you a link" flow would never deliver. Instead an
 * administrator issues a one-time password here and passes it on in person or by phone;
 * the colleague is asked to choose their own at the next sign-in, and the reason is kept
 * in the audit trail like any other change to an account.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminConsoleUser } from '@tfd/domain';
import { useCurrentUser } from '@/auth/authStore';
import { IssuedPasswordField } from '@/components/IssuedPasswordField';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { useResetUserPassword } from './hooks';

const REASON_MIN = 10;

export function ResetUserPasswordDialog({
  user,
  onClose,
}: {
  user: AdminConsoleUser | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const actingUser = useCurrentUser();
  const reset = useResetUserPassword();
  const [reason, setReason] = useState('');
  const [issued, setIssued] = useState<string | null>(null);

  function close() {
    setReason('');
    setIssued(null);
    onClose();
  }

  async function submit() {
    if (!user) return;
    try {
      const result = await reset.mutateAsync({
        id: user.id,
        reason: reason.trim(),
        actingUserId: actingUser?.id,
      });
      setIssued(result.password);
    } catch (cause) {
      toast.error(t('users.resetPassword.failed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      size="md"
      title={user ? t('users.resetPassword.title', { name: user.name }) : ''}
      description={issued ? t('users.resetPassword.issuedBody') : t('users.resetPassword.body')}
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
              disabled={reason.trim().length < REASON_MIN}
              loading={reset.isPending}
              onClick={() => void submit()}
            >
              {t('users.resetPassword.confirm')}
            </Button>
          </>
        )
      }
    >
      {issued ? (
        <div className="flex flex-col gap-md">
          <IssuedPasswordField password={issued} />
          <p className="rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
            {t('suppliers.resetPassword.onceWarning')}
          </p>
        </div>
      ) : (
        <Field
          label={t('common.reason')}
          required
          hint={t('users.reasonHint', { min: REASON_MIN })}
        >
          {({ id, describedBy, invalid, required }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              autoFocus
              rows={3}
              placeholder={t('users.resetPassword.placeholder')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      )}
    </Dialog>
  );
}
