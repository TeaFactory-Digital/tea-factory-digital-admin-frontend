/**
 * Modal dialog, on Radix.
 *
 * Radix here rather than a native `<dialog>` because focus trapping, scroll
 * locking and `aria-describedby` wiring are exactly the things a hand-rolled
 * modal gets subtly wrong, and this dialog is where irreversible decisions are
 * confirmed — an approve, a reject, a suspension, a full account number.
 */

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** `sm` for a confirmation, `md` for a form. */
  size?: 'sm' | 'md';
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'sm',
}: DialogProps) {
  const { t } = useTranslation();

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <RadixDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-border bg-surface shadow-lg',
            'max-h-[calc(100vh-4rem)] overflow-y-auto',
            size === 'sm' ? 'max-w-dialog' : 'max-w-dialog-wide',
          )}
        >
          <div className="flex items-start justify-between gap-md border-b border-divider px-lg py-md">
            <div className="min-w-0">
              <RadixDialog.Title className="text-title text-text-primary">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-xxs text-body-small text-text-secondary">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              aria-label={t('common.close')}
              className="rounded-md p-xs text-text-secondary hover:bg-surface-variant"
            >
              <X className="size-icon-md" aria-hidden />
            </RadixDialog.Close>
          </div>

          {children ? <div className="px-lg py-md">{children}</div> : null}

          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-sm border-t border-divider px-lg py-md">
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
