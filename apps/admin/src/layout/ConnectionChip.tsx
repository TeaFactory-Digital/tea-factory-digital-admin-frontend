/**
 * "No connection", in the top bar while this computer is offline (26 November 2026).
 *
 * An office on a rural line loses it for minutes at a time, and without this the only sign
 * was a request failing with a message about the network after the clerk had already typed
 * a note. Shown as a chip beside the sync chip, in the same shape, and gone the moment the
 * line is back; the shell then says so once (`useConnectionNotice`).
 */

import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { useOnline } from '@/lib/useOnline';

export function ConnectionChip() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;

  return (
    <span
      role="status"
      title={t('connection.offlineHint')}
      className="tfd-chip-in inline-flex items-center gap-xs rounded-full bg-warning-muted px-sm py-xxs text-label text-warning"
    >
      <WifiOff className="size-icon-sm shrink-0" aria-hidden />
      <span className="whitespace-nowrap">{t('connection.offline')}</span>
    </span>
  );
}
