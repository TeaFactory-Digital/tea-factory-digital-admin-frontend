/**
 * The month options M5 and M6 share, and the rule for choosing between them.
 *
 * Separate from `MonthSelect.tsx` so that file exports only a component — a module
 * mixing components with hooks and helpers breaks fast refresh, and this pair is
 * imported by two modules anyway.
 */

import { useQuery } from '@tanstack/react-query';
import type { BillMonth } from '@tfd/domain';
import { billRepository } from '@/services/repositories/billRepository';

export const MONTH_OPTIONS_KEY = ['bill-months'] as const;

export function useBillMonths() {
  return useQuery({
    queryKey: MONTH_OPTIONS_KEY,
    queryFn: () => billRepository.months(),
    // The set of months changes once a month. A minute is fresher than it needs to be.
    staleTime: 60_000,
  });
}

/**
 * Resolve the month to show: the requested one if the API knows it, otherwise the
 * first that passes `prefer`, otherwise the newest.
 *
 * The URL is **checked against the months the API returned, not trusted**. A stale
 * bookmark, a typo, or a key pasted from another screen would otherwise be sent to the
 * server as a month — and a screen that renders whatever comes back is a screen that
 * can show a month the factory has no records for. The same rule is written out in
 * `MonthCloseScreen`; this is where the money modules get it from.
 *
 * `prefer` exists because the two modules open on different months. M5 wants the one
 * being worked — the open month, where a run is still possible. M6 wants the latest
 * **published** one, because a payout run against an open month is refused.
 */
export function resolveMonthKey(
  months: BillMonth[] | undefined,
  requested: string | null,
  prefer?: (month: BillMonth) => boolean,
): string {
  const known = months ?? [];
  if (requested && known.some((month) => month.monthKey === requested)) return requested;
  if (prefer) {
    const preferred = known.find(prefer);
    if (preferred) return preferred.monthKey;
  }
  return known[0]?.monthKey ?? '';
}
