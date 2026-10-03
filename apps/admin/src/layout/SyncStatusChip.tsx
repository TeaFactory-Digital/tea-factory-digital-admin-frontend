/**
 * The top bar's reminder that the figures are not current, **only while they are not**.
 *
 * Replaces the full-width banner that sat over every screen. Small, but not hidden: it
 * stays in the top bar on every page for as long as the state lasts, in the warning or
 * error colour, and it is a link to the page that explains it (`/data-status`). A clerk
 * about to quote a balance still has it in view, without a paragraph above every screen.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFactorySync } from './useFactorySync';

export function SyncStatusChip() {
  const { t } = useTranslation();
  const { state } = useFactorySync();

  if (state === 'fresh') return null;

  return (
    <Link
      to="/data-status"
      title={t('dataStatus.chipHint')}
      className={cn(
        'inline-flex items-center gap-xs rounded-full px-sm py-xxs text-label hover:opacity-90',
        state === 'never' ? 'bg-error-muted text-error' : 'bg-warning-muted text-warning',
      )}
    >
      <AlertTriangle className="size-icon-sm shrink-0" aria-hidden />
      <span className="whitespace-nowrap">{t(`dataStatus.chip.${state}`)}</span>
    </Link>
  );
}
