/**
 * Copy a short value (a supplier number) in one click (26 November 2026). The icon turns
 * into a tick that pops for a moment (`tfd-tick-pop`), and a screen reader hears "Copied",
 * so the copy is confirmed without a toast covering the page.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard here (an old browser, a denied permission): the value is on screen to select.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? t('suppliers.resetPassword.copied') : label}
      title={label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-variant hover:text-text-primary',
        copied && 'text-success hover:text-success',
        className,
      )}
    >
      {copied ? (
        <Check className="tfd-tick-pop size-icon-sm" strokeWidth={2.5} aria-hidden />
      ) : (
        <Copy className="size-icon-sm" aria-hidden />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? t('suppliers.resetPassword.copied') : ''}
      </span>
    </button>
  );
}
