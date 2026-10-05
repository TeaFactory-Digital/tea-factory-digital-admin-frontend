/**
 * A one-time password the office has just issued, in a read-only password field: hidden
 * until asked for, exactly as it is typed (no dashes added), with a copy button. Used for a
 * supplier's app password and for a console user's password.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

/** The issued password in a read-only password field, with show/hide and copy. */
export function IssuedPasswordField({ password }: { password: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('suppliers.resetPassword.copyFailed'));
    }
  }

  return (
    <Field label={t('suppliers.resetPassword.passwordLabel')}>
      {({ id, describedBy }) => (
        <div className="flex items-center gap-xs">
          <div className="relative flex-1">
            <Input
              id={id}
              aria-describedby={describedBy}
              type={visible ? 'text' : 'password'}
              value={password}
              readOnly
              autoComplete="off"
              spellCheck={false}
              className="numeric pr-11 text-subtitle"
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => setVisible((shown) => !shown)}
              aria-label={
                visible
                  ? t('suppliers.resetPassword.hidePassword')
                  : t('suppliers.resetPassword.showPassword')
              }
              aria-pressed={visible}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-text-secondary hover:text-primary"
            >
              {visible ? (
                <EyeOff className="size-icon-sm" aria-hidden />
              ) : (
                <Eye className="size-icon-sm" aria-hidden />
              )}
            </button>
          </div>
          <Button
            variant="secondary"
            iconLeft={
              copied ? (
                <Check className="size-icon-sm" aria-hidden />
              ) : (
                <Copy className="size-icon-sm" aria-hidden />
              )
            }
            onClick={() => void copy()}
          >
            {copied ? t('suppliers.resetPassword.copied') : t('suppliers.resetPassword.copy')}
          </Button>
        </div>
      )}
    </Field>
  );
}
