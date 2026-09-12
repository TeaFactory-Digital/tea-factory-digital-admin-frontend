/**
 * The console's sign-in screen — a separate realm from the app's.
 *
 * Branded from `GET /config`, which is why that endpoint is public: a login page
 * that had to wait for a token to learn the factory's name would be identical and
 * grey for every tenant, and a clerk could not tell which deployment they were
 * pointed at.
 *
 * **One step.** The screen used to ask manager-and-above for a TOTP code after the
 * password; the factory has withdrawn that requirement, because the console is worked
 * from shared office machines where a code on one person's phone stops whoever is at the
 * counter. What guards a senior action is the audit trail and the four-eyes rule on the
 * action itself, not a second factor at the door.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { loginSchema, type LoginInput } from '@tfd/domain';
import { useAuthStore } from './authStore';
import { useFactory } from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, CardBody } from '@/components/ui/Card';
import { errorMessageKey } from '@/lib/errorMessage';

export function SignInScreen() {
  const { t } = useTranslation();
  const factory = useFactory();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/sign-in' ? from : '/'} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-lg">
      <div className="flex w-full max-w-card flex-col gap-lg">
        <div className="flex flex-col items-center gap-sm text-center">
          {/* Larger here than in the chrome: this is the one screen where the
              mark is the subject rather than a label, and it is how a clerk on a
              shared machine confirms which factory's console they are signing
              into before they type a password. */}
          <Logo showName={false} size="lg" className="justify-center" />
          <h1 className="text-h3 text-text-primary">{t('auth.signInTitle')}</h1>
          <p className="text-body-small text-text-secondary">
            {t('auth.signInSubtitle', { factory: factory.name })}
          </p>
        </div>

        {/* Before the form, not in a corner of it.
            The chrome language is a `localStorage` preference, so it survives from
            whoever used this machine last — which means the person who most needs to
            change it arrives at a screen they cannot read. Tab reaches this before
            the email field, and it is the one control here that works without a
            session. */}
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>

        <Card>
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>

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

