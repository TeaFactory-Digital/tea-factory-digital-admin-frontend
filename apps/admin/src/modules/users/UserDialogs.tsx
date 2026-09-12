/**
 * Inviting a user, editing one, and the two things that need a reason.
 *
 * The reason is mandatory on suspend **and** reactivate, for the same argument AC-06 makes
 * about a rejection note: the person it happens to will ask, and "suspended on the 14th"
 * with no why is a conversation nobody in the office can have. A colleague is owed that at
 * least as much as a supplier.
 *
 * Roles are checkboxes rather than a single select, because §12.1 is a set — a person can be
 * the editor and the factory administrator at a small factory, and `grantsFromRoles`
 * takes the highest level any of their roles grants.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_ROLE_MATRIX,
  emailSchema,
  type AdminConsoleUser,
  type ConsoleRole,
  type LockoutCandidate,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Label } from '@/components/ui/Label';
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

function getNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'validation.required';
  if (trimmed.length > 120) return 'validation.tooLong';
  return null;
}

function getEmailError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'validation.required';
  const result = emailSchema.safeParse(trimmed);
  if (!result.success) {
    return result.error.issues[0]?.message ?? 'validation.email';
  }
  return null;
}

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
  const [touchedName, setTouchedName] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  /**
   * The new account's first password, shown **once**.
   *
   * There is no invitation email: the API takes a password at creation and the office
   * hands it over, which is what `users.createdHint` has always said. Held here and
   * dropped when the dialog closes — a credential left in component state is one a
   * re-opened dialog would show to whoever is at the desk next, the same rule
   * `ResetPasswordDialog` follows.
   */
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setRoles(user?.roles ?? []);
    setTouchedName(false);
    setTouchedEmail(false);
    setSubmitted(false);
    setIssuedPassword(null);
  }, [open, user]);

  const editing = user !== null;
  const isSelf = editing && user.id === context.actingUserId;

  const nameError = getNameError(name);
  const emailError = editing ? null : getEmailError(email);

  const showNameError = (touchedName || submitted) && nameError;
  const showEmailError = !editing && (touchedEmail || submitted) && emailError;

  const complete = !nameError && !emailError && roles.length > 0;

  async function submit() {
    setSubmitted(true);
    if (!complete) return;
    setConfirmingSubmit(true);
  }

  async function confirmSubmit() {
    try {
      if (editing) {
        await update.mutateAsync({ id: user.id, body: { name: name.trim(), roles }, context });
        toast.success(t('users.updated', { name: name.trim() }));
        setConfirmingSubmit(false);
        onClose();
      } else {
        const created = await create.mutateAsync({ name: name.trim(), email: email.trim(), roles });
        toast.success(t('users.created', { name: name.trim() }), t('users.createdHint'));
        setConfirmingSubmit(false);
        // The dialog stays OPEN on create, showing the password. Closing here would
        // destroy the only copy of a credential nobody can re-read.
        setIssuedPassword(created.password);
      }
    } catch (cause) {
      // The dialog stays open: `last-admin` and `email-taken` are both information about
      // what to change, not a toast over a discarded form.
      toast.error(editing ? t('users.updateFailed') : t('users.createFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        size="md"
        title={editing ? t('users.editTitle', { name: user.name }) : t('users.inviteTitle')}
        description={editing ? t('users.editBody') : t('users.inviteBody')}
        footer={
          issuedPassword ? (
            <Button variant="primary" onClick={onClose}>
              {t('users.passwordDone')}
            </Button>
          ) : (
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
          )
        }
      >
        {issuedPassword ? (
          <div className="flex flex-col gap-md">
            <p
              className="numeric select-all rounded-md bg-surface-variant px-lg py-md text-center text-h3 tracking-widest text-text-primary"
              aria-label={t('users.passwordLabel')}
            >
              {issuedPassword}
            </p>
            <p className="rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
              {t('users.passwordOnce')}
            </p>
            <p className="text-body-small text-text-secondary">
              {t('users.passwordHandover', { name: name.trim(), email: email.trim() })}
            </p>
          </div>
        ) : (
        <div className="flex flex-col gap-md">
        <Field label={t('users.field.name')} required error={showNameError ? t(showNameError) : undefined}>
          {({ id, required, invalid }) => (
            <Input
              id={id}
              required={required}
              invalid={invalid}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouchedName(true)}
            />
          )}
        </Field>

        <Field
          label={t('users.field.email')}
          required={!editing}
          error={showEmailError ? t(showEmailError) : undefined}
          hint={editing ? t('users.field.emailLocked') : t('users.field.emailHint')}
        >
          {({ id, describedBy, required, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              required={required}
              invalid={invalid}
              type="email"
              // The identity a session is issued against. Changing it would be creating a
              // different person while keeping their audit trail.
              disabled={editing}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouchedEmail(true)}
            />
          )}
        </Field>

        <fieldset className="flex flex-col gap-xs">
          <legend className="text-label text-text-primary">{t('users.field.roles')}</legend>
          <p className="text-caption text-text-secondary">{t('users.field.rolesHint')}</p>

          {ROLES.map((role) => (
            <Label key={role} className="flex items-center gap-sm text-body-small text-text-primary">
              <Checkbox
                checked={roles.includes(role)}
                // Editing your own roles mid-session is never what was meant, and the
                // server refuses it (`self-modification`).
                disabled={isSelf}
                onCheckedChange={(checked) =>
                  setRoles(
                    checked === true
                      ? [...roles, role]
                      : roles.filter((one) => one !== role),
                  )
                }
              />
              {t(`users.role.${role}`)}
            </Label>
          ))}

          {isSelf ? (
            <p className="text-caption text-warning">{t('users.cannotEditOwnRoles')}</p>
          ) : null}
        </fieldset>
        </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmingSubmit}
        onOpenChange={setConfirmingSubmit}
        title={editing ? t('users.editTitle', { name: user?.name ?? '' }) : t('users.inviteTitle')}
        description={editing ? t('users.editBody') : t('users.inviteBody')}
        confirmLabel={editing ? t('common.save') : t('users.invite')}
        confirmVariant="primary"
        onConfirm={() => void confirmSubmit()}
        loading={create.isPending || update.isPending}
      >
        <p className="text-body-small text-text-secondary">
          {editing ? t('users.confirmEditBody') : t('users.confirmCreateBody')}
        </p>
      </ConfirmDialog>
    </>
  );
}

/**
 * Suspend or reactivate — both with a mandatory reason.
 *
 * One dialog because the shape is identical and the copy is what differs.
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
  const [confirmingAction, setConfirmingAction] = useState(false);
  useEffect(() => setReason(''), [user?.id, action]);

  const blocked = reason.trim().length < REASON_MIN;

  async function submit() {
    if (!user) return;
    setConfirmingAction(true);
  }

  async function confirmAction() {
    if (!user) return;
    try {
      await run.mutateAsync({ id: user.id, action, reason: reason.trim(), context });
      toast.success(t(`users.${action}Done`, { name: user.name }));
      setConfirmingAction(false);
      onClose();
    } catch (cause) {
      toast.error(t(`users.${action}Failed`), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <Dialog
        open={user !== null && !confirmingAction}
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

      <ConfirmDialog
        open={confirmingAction && user !== null}
        onOpenChange={(open) => {
          setConfirmingAction(open);
          if (!open && !user) {
            onClose();
          }
        }}
        title={user ? t(`users.${action}Title`, { name: user.name }) : ''}
        description={t(`users.${action}Body`)}
        confirmLabel={t(`users.${action}Confirm`)}
        confirmVariant={action === 'reactivate' ? 'primary' : 'danger'}
        onConfirm={() => void confirmAction()}
        loading={run.isPending}
      >
        <p className="text-body-small text-text-secondary">
          {t('users.confirmActionBody', { action: t(`users.${action}Confirm`) })}
        </p>
      </ConfirmDialog>
    </>
  );
}
