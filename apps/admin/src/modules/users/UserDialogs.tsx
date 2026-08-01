/**
 * Inviting a user, editing one, and the three things that need a reason.
 *
 * The reason is mandatory on suspend, reactivate **and** an MFA reset, for the same argument
 * AC-06 makes about a rejection note: the person it happens to will ask, and "suspended on
 * the 14th" with no why is a conversation nobody in the office can have. A colleague is owed
 * that at least as much as a supplier.
 *
 * Roles are checkboxes rather than a single select, because §12.1 is a set — a person can be
 * the accountant and the factory administrator at a small factory, and `grantsFromRoles`
 * takes the highest level any of their roles grants.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import {
  DEFAULT_ROLE_MATRIX,
  requiresMfa,
  type AdminConsoleUser,
  type ConsoleRole,
  type LockoutCandidate,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import {
  useCreateUser,
  useLockoutContext,
  useUpdateUser,
  useUserAction,
  type UserAction,
} from './hooks';

const ROLES = Object.keys(DEFAULT_ROLE_MATRIX) as ConsoleRole[];
const REASON_MIN = 10;

/** Invite, or change a name and roles. `user` null means invite. */
export function UserDialog({
  open,
  user,
  users,
  onClose,
}: {
  open: boolean;
  user: AdminConsoleUser | null;
  users: readonly LockoutCandidate[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const context = useLockoutContext(users);
  const create = useCreateUser();
  const update = useUpdateUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<ConsoleRole[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setRoles(user?.roles ?? []);
  }, [open, user]);

  const editing = user !== null;
  const isSelf = editing && user.id === context.actingUserId;
  const complete = name.trim() && (editing || email.trim()) && roles.length > 0;

  async function submit() {
    try {
      if (editing) {
        await update.mutateAsync({ id: user.id, body: { name: name.trim(), roles }, context });
        toast.success(t('users.updated', { name: name.trim() }));
      } else {
        await create.mutateAsync({ name: name.trim(), email: email.trim(), roles });
        toast.success(t('users.created', { name: name.trim() }), t('users.createdHint'));
      }
      onClose();
    } catch (cause) {
      // The dialog stays open: `last-admin` and `email-taken` are both information about
      // what to change, not a toast over a discarded form.
      toast.error(editing ? t('users.updateFailed') : t('users.createFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title={editing ? t('users.editTitle', { name: user.name }) : t('users.inviteTitle')}
      description={editing ? t('users.editBody') : t('users.inviteBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!complete}
            loading={create.isPending || update.isPending}
            onClick={() => void submit()}
          >
            {editing ? t('common.save') : t('users.invite')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Field label={t('users.field.name')} required>
          {({ id, required }) => (
            <Input id={id} required={required} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>

        <Field
          label={t('users.field.email')}
          required={!editing}
          hint={editing ? t('users.field.emailLocked') : t('users.field.emailHint')}
        >
          {({ id, describedBy, required }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              required={required}
              type="email"
              // The identity a session is issued against. Changing it would be creating a
              // different person while keeping their audit trail.
              disabled={editing}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <fieldset className="flex flex-col gap-xs">
          <legend className="text-label text-text-primary">{t('users.field.roles')}</legend>
          <p className="text-caption text-text-secondary">{t('users.field.rolesHint')}</p>

          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-sm text-body-small text-text-primary">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={roles.includes(role)}
                // Editing your own roles mid-session is never what was meant, and the
                // server refuses it (`self-modification`).
                disabled={isSelf}
                onChange={(event) =>
                  setRoles(
                    event.target.checked
                      ? [...roles, role]
                      : roles.filter((one) => one !== role),
                  )
                }
              />
              {t(`users.role.${role}`)}
            </label>
          ))}

          {isSelf ? (
            <p className="text-caption text-warning">{t('users.cannotEditOwnRoles')}</p>
          ) : null}
        </fieldset>

        {/**
         * The MFA obligation, stated rather than enforced at this point.
         *
         * A user cannot enrol before they have an account, so refusing to create a manager
         * without a second factor would make the senior roles unassignable. The console says
         * what is now owed; the sign-in is what insists on it.
         */}
        {requiresMfa(roles) ? (
          <p className="flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
            <ShieldAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
            {t('users.mfaObligation')}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * Suspend, reactivate or reset a second factor — all three with a mandatory reason.
 *
 * One dialog because the shape is identical and the copy is what differs. The MFA reset gets
 * the strongest wording: it is the only action here that is a security operation, and it is
 * exactly what an attacker holding an administrator session would do.
 */
export function UserActionDialog({
  user,
  action,
  users,
  onClose,
}: {
  user: AdminConsoleUser | null;
  action: UserAction;
  users: readonly LockoutCandidate[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const context = useLockoutContext(users);
  const run = useUserAction();

  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [user?.id, action]);

  const blocked = reason.trim().length < REASON_MIN;

  async function submit() {
    if (!user) return;
    try {
      await run.mutateAsync({ id: user.id, action, reason: reason.trim(), context });
      toast.success(t(`users.${action}Done`, { name: user.name }));
      onClose();
    } catch (cause) {
      toast.error(t(`users.${action}Failed`), t(errorMessageKey(cause)));
    }
  }

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={user ? t(`users.${action}Title`, { name: user.name }) : ''}
      description={t(`users.${action}Body`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={action === 'reactivate' ? 'primary' : 'danger'}
            disabled={blocked}
            loading={run.isPending}
            onClick={() => void submit()}
          >
            {t(`users.${action}Confirm`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {user ? (
          <p className="rounded-md bg-surface-variant px-md py-sm text-body-small text-text-primary">
            {user.name} · {user.email} · {user.roles.map((role) => t(`users.role.${role}`)).join(', ')}
          </p>
        ) : null}

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
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
