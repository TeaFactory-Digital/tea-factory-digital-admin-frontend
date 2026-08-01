/**
 * The console's sign-in screen — a separate realm from the app's.
 *
 * Branded from `GET /config`, which is why that endpoint is public: a login page
 * that had to wait for a token to learn the factory's name would be identical and
 * grey for every tenant, and a clerk could not tell which deployment they were
 * pointed at.
 *
 * The two-step shape (password, then TOTP) is not optional dressing: MFA is
 * mandatory for manager and above, and the manager is the only role that can
 * approve credit above threshold, close a month or publish bills.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { loginSchema, mfaSchema, type LoginInput, type MfaInput } from '@tfd/domain';
import { useAuthStore } from './authStore';
import { env } from '@/config/env';
import { useFactory } from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, CardBody } from '@/components/ui/Card';
import { errorMessageKey } from '@/lib/errorMessage';
import { MOCK_MFA_CODE, MOCK_PASSWORD, mockUsers } from '@/services/mocks/seed';

export function SignInScreen() {
  const { t } = useTranslation();
  const factory = useFactory();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);
  const challenge = useAuthStore((s) => s.challenge);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/sign-in' ? from : '/'} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-lg">
      <div className="flex w-full max-w-card flex-col gap-lg">
        <div className="flex flex-col items-center gap-sm text-center">
          <Logo showName={false} className="justify-center" />
          <h1 className="text-h3 text-text-primary">{t('auth.signInTitle')}</h1>
          <p className="text-body-small text-text-secondary">
            {t('auth.signInSubtitle', { factory: factory.name })}
          </p>
        </div>

        <Card>
          <CardBody>
            {status === 'mfaRequired' && challenge ? <MfaForm /> : <PasswordForm />}
          </CardBody>
        </Card>

        <p className="text-center text-caption text-text-secondary">
          {t('auth.supplierWrongPlace')}
        </p>

        {env.useMock ? <MockCredentials /> : null}
      </div>
    </div>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    try {
      await login(email, password);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
      <Field label={t('auth.email')} error={errors.email && t(errors.email.message ?? '')} required>
        {({ id, describedBy, invalid, required }) => (
          <Input
            id={id}
            type="email"
            autoComplete="username"
            autoFocus
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            {...register('email')}
          />
        )}
      </Field>

      <Field
        label={t('auth.password')}
        error={errors.password && t(errors.password.message ?? '')}
        required
        hint={t('auth.forgotPasswordHint')}
      >
        {({ id, describedBy, invalid, required }) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            {...register('password')}
          />
        )}
      </Field>

      {submitError ? (
        <p role="alert" className="text-body-small text-error">
          {t(errorMessageKey(submitError))}
        </p>
      ) : null}

      <Button type="submit" variant="primary" loading={isSubmitting}>
        {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
    </form>
  );
}

function MfaForm() {
  const { t } = useTranslation();
  const verifyMfa = useAuthStore((s) => s.verifyMfa);
  const clear = useAuthStore((s) => s.clear);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaInput>({ resolver: zodResolver(mfaSchema), defaultValues: { code: '' } });

  const onSubmit = handleSubmit(async ({ code }) => {
    setSubmitError(null);
    try {
      await verifyMfa(code);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
      <div>
        <h2 className="text-title text-text-primary">{t('auth.mfaTitle')}</h2>
        <p className="mt-xxs text-body-small text-text-secondary">{t('auth.mfaSubtitle')}</p>
      </div>

      <Field label={t('auth.mfaCode')} error={errors.code && t(errors.code.message ?? '')} required>
        {({ id, describedBy, invalid, required }) => (
          <Input
            id={id}
            // `one-time-code` so the OS keyboard and password managers offer the
            // right thing; `numeric` so a tablet shows digits.
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={7}
            autoFocus
            className="numeric tracking-widest"
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            {...register('code')}
          />
        )}
      </Field>

      {submitError ? (
        <p role="alert" className="text-body-small text-error">
          {t(errorMessageKey(submitError))}
        </p>
      ) : null}

      <div className="flex gap-sm">
        <Button type="submit" variant="primary" loading={isSubmitting} className="flex-1">
          {t('auth.mfaVerify')}
        </Button>
        <Button type="button" variant="ghost" onClick={clear}>
          {t('common.cancel')}
        </Button>
      </div>

      <p className="text-caption text-text-secondary">{t('auth.mfaRequiredNote')}</p>
    </form>
  );
}

/**
 * Mock credentials, printed on screen while `VITE_USE_MOCK` is on.
 *
 * Deliberate: a demo credential that has to be looked up in a source file gets
 * pasted into a chat thread and outlives the demo. It renders in development and
 * in the hosted demo build (`npm run build:demo`) — where it is the only way a
 * visitor gets in, and where printing it costs nothing because the accounts are
 * fixtures. It cannot render in a real production build: `env.useMock` is false
 * there and `assertEnvUsable()` refuses to boot if it is not.
 */
/**
 * Every mock identity, not a chosen two.
 *
 * Which account you sign in as decides what the console will let you do, and
 * §12.1 spreads that across four roles: the **weigher** records leaf, the
 * **accountant** enters the rate, the **manager** publishes the month, and the
 * **clerk** works the change-request queue. Listing only two left the two roles
 * M3 and M4 need undiscoverable, and a reviewer concluding "leaf entry is broken"
 * when they were signed in as a clerk is the matrix working and the screen
 * failing to say so.
 *
 * Derived from `mockUsers` rather than written out, so an identity added to the
 * fixture cannot go missing here.
 */
function MockCredentials() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardBody className="flex flex-col gap-xs">
        <p className="text-label text-text-primary">{t('auth.demoCredentials')}</p>
        {mockUsers.map((user) => (
          <p key={user.id} className="numeric text-caption text-text-secondary">
            {t(`auth.demoRole.${user.roles[0]}`)}
            {user.mfaEnrolled ? ` ${t('auth.demoMfa', { code: MOCK_MFA_CODE })}` : ''}:{' '}
            {user.email} / {MOCK_PASSWORD}
          </p>
        ))}
      </CardBody>
    </Card>
  );
}
