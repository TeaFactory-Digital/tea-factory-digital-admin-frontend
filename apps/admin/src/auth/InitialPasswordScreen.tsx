/**
 * BR-008 for the office: **replace the password somebody else chose for you.**
 *
 * The factory settled that the office sets a console user's first credential rather than
 * an invitation email going out, because there is no mail sender in this system and a
 * flow that silently depends on one is a flow that never delivers an account. That makes
 * a new console user's password exactly the case BR-008 exists for: the one password the
 * holder did not pick, may never change, and was very likely read out down a corridor.
 *
 * ## Why keeping it is an option
 *
 * `userRepository` mints a 16-character random password rather than letting an
 * administrator type one, so the issued credential is usually *stronger* than what its
 * holder would choose under pressure to get on with their morning. A flow whose only exit
 * is "type a new one" teaches people to type a weaker one.
 *
 * So the second button is not a way out of the rule, it is a way through it, and the API
 * records the decision rather than ignoring it.
 *
 * ## Why this is a screen and not a dialog
 *
 * The API issues a session and then refuses every path except the handful that can clear
 * the flag. There is no console behind this to dismiss it onto: a dialog over an
 * otherwise-live dashboard would be a lie about what the clerk can do, and every panel
 * behind it would be showing a spinner over a refusal.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './authStore';
import { authRepository } from '@/services/repositories/authRepository';
import { useFactory } from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, CardBody } from '@/components/ui/Card';
import { errorMessageKey } from '@/lib/errorMessage';

/**
 * The API's floor, checked here so a short one is refused without a round trip.
 *
 * The server answers `422 invalid` with `{ field: 'password', minLength: 12 }` rather
 * than a code of its own, so there is nothing more specific to render than the generic
 * refusal. Catching it here is what gives the clerk a sentence they can act on.
 *
 * ⚠️ **Nothing refuses re-entering the password you were given.** The API does not
 * compare the new password with the current one, in either realm, so BR-008 can be
 * satisfied by retyping what was read out down the corridor. Not worked around here: a
 * console cannot compare against a hash it has never seen, and a client-side check
 * against the string the clerk typed at sign-in would be a credential kept in memory for
 * no good reason. Recorded in `BACKEND-API-GAPS.md`.
 */
const MIN_LENGTH = 12;

export function InitialPasswordScreen() {
  const { t } = useTranslation();
  const factory = useFactory();
  const clearFlag = useAuthStore((s) => s.clearOwesPasswordChange);
  const logout = useAuthStore((s) => s.logout);

  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'set' | 'keep' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = next.length >= MIN_LENGTH && confirm === next && busy === null;

  async function run(what: 'set' | 'keep') {
    setBusy(what);
    setError(null);
    try {
      if (what === 'set') await authRepository.setInitialPassword(next);
      else await authRepository.keepInitialPassword();
      /*
       * Cleared only after the API has accepted. Clearing optimistically would drop the
       * clerk into a console whose every request is still refused, which is the exact
       * dead end this screen exists to prevent.
       */
      clearFlag();
    } catch (cause) {
      setError(t(errorMessageKey(cause)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-lg">
      <div className="flex w-full max-w-card flex-col gap-lg">
        <div className="flex flex-col items-center gap-sm text-center">
          <Logo />
          <p className="text-body-small text-text-secondary">{factory?.name}</p>
        </div>

        <Card>
          <CardBody className="flex flex-col gap-md">
            <div className="flex flex-col gap-xs">
              <h1 className="text-title text-text-primary">{t('initialPassword.title')}</h1>
              <p className="text-body-small text-text-secondary">
                {t('initialPassword.body')}
              </p>
            </div>

            <Field
              label={t('initialPassword.next')}
              error={tooShort ? t('initialPassword.tooShort', { min: MIN_LENGTH }) : undefined}
              hint={t('initialPassword.hint', { min: MIN_LENGTH })}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              )}
            </Field>

            <Field
              label={t('initialPassword.confirm')}
              error={mismatch ? t('initialPassword.mismatch') : undefined}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              )}
            </Field>

            {error ? (
              <p role="alert" className="text-caption text-error">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-sm">
              <Button
                variant="primary"
                onClick={() => void run('set')}
                disabled={!canSubmit}
                loading={busy === 'set'}
              >
                {t('initialPassword.submit')}
              </Button>

              {/* Secondary, and deliberately not hidden behind a disclosure: an exit a
                  clerk cannot find is an exit that does not exist. */}
              <Button
                variant="ghost"
                onClick={() => void run('keep')}
                disabled={busy !== null}
                loading={busy === 'keep'}
              >
                {t('initialPassword.keep')}
              </Button>
            </div>

            {/* The way out for somebody signed in as the wrong person on a shared
                machine. Sign-out is one of the few paths the API leaves open here. */}
            <Button variant="ghost" onClick={() => void logout()} disabled={busy !== null}>
              {t('nav.signOut')}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
