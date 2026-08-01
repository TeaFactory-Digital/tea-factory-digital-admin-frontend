/**
 * Status → badge tone, for the two payout screens.
 *
 * In its own module so neither screen has to import the other for a colour map, and so
 * a run reads the same on the list as it does on its own page. Colour is never the only
 * signal — every badge these feed carries its own text (see `Badge`).
 */

import type { PayoutLineStatus, PayoutRunStatus } from '@tfd/domain';
import type { BadgeTone } from '@/components/ui/Badge';

export const RUN_TONES: Record<PayoutRunStatus, BadgeTone> = {
  draft: 'neutral',
  approved: 'info',
  completed: 'success',
};

/**
 * Ordered by how much attention the line needs, which is the same order the grid
 * sorts in: a held line blocks a supplier being paid at all, a failed one has to be
 * chased, a pending one is simply not done yet.
 */
export const LINE_TONES: Record<PayoutLineStatus, BadgeTone> = {
  held: 'warning',
  failed: 'error',
  pending: 'neutral',
  paid: 'success',
};
