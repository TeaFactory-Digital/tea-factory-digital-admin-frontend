/**
 * *"These figures are current as of …"* — on the screens a number is read aloud from.
 *
 * The shell already raises a notice when replication has fallen behind, and that is the
 * safety net. This is the everyday case: the sync is **healthy**, and the office still
 * needs to know that what it is looking at is a copy with an age, not a live read of the
 * factory's ledger.
 *
 * The distinction is the whole reason both exist. A banner that only appears when
 * something is wrong teaches the office that no banner means *live* — so on the day the
 * banner is a few minutes late, a figure gets quoted as though it were.
 *
 * Rendered as one quiet line rather than a badge or a tooltip: a clerk on the telephone
 * is reading down the screen, and a hover target is not something they will find.
 */

import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime } from '@/lib/format';
import { useFactorySync } from '@/layout/useFactorySync';

export function SyncFreshness() {
  const { t } = useTranslation();
  const { status, state } = useFactorySync();

  /**
   * Silent when the shell is already shouting.
   *
   * A stale sync raises a warning across the whole console; repeating it here in
   * smaller grey type would add nothing and would train the reader to skim past the
   * line in the case where it *is* the only signal.
   */
  if (state !== 'fresh' || !status?.lastSucceededAt) return null;

  return (
    <p className="text-caption text-text-secondary">
      {t('sync.freshAsOf', {
        when: formatDateTime(status.lastSucceededAt),
        // The sentence the office can actually say to a supplier. "Synced 12 minutes
        // ago" is not answerable to somebody asking about last Tuesday.
        covers: formatDate(status.coversUpTo),
      })}
    </p>
  );
}
