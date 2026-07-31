/**
 * Shared basis for the credit the factory extends against green leaf.
 *
 * Ported from the mobile app's `src/services/repositories/leafCredit.ts` with
 * the one change operations.md asks for: **the `mockDb` import is gone and
 * bills are a parameter**. The functions already supported that.
 *
 * Why the console needs this at all: AC-05 requires the eligibility figures in
 * a credit queue row to match `GET /advances|loans|manure/eligibility` for that
 * supplier *byte for byte*. If the approver sees different numbers from the
 * applicant, every rejection becomes a dispute. The server computes the
 * authoritative figures; this module is how the console re-derives them
 * identically when it needs to show the working.
 *
 * All three facilities are priced off **settled** months only. The month in
 * progress has no rate until its auction closes, so it can never price a
 * ceiling, count towards history, or be averaged.
 */

import { LIMIT_MULTIPLIER, REQUIRED_MONTHS_OF_HISTORY } from './constants';
import { floor2 } from './money';
import type { GreenLeafBill } from './types/app';

/** Newest month first; the first entry is the month in progress. */
export function billsNewestFirst(bills: GreenLeafBill[]): GreenLeafBill[] {
  return [...bills].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/**
 * The newest closed month — the last one whose auction result is in.
 *
 * The month in progress is never the answer: its own rate does not exist yet,
 * which is why a ceiling has to be priced off the month before.
 */
export function lastSettledBill(bills: GreenLeafBill[]): GreenLeafBill | undefined {
  return billsNewestFirst(bills)
    .slice(1)
    .find((b) => b.totalRatePerKg != null);
}

/** The supplier's settled income history, newest month first. */
export function settledBills(bills: GreenLeafBill[]): GreenLeafBill[] {
  return billsNewestFirst(bills).filter((b) => b.auctionResultAvailable && b.grossAmount != null);
}

/** How many closed months of income history the supplier has. */
export function monthsOfHistory(bills: GreenLeafBill[]): number {
  return settledBills(bills).length;
}

/**
 * Average monthly income across the most recent closed months — "income" being
 * the bill's **gross amount**, i.e. before deductions, the same figure the
 * income-history screen charts.
 *
 * Returns 0 when the history is short of `months`, so a caller that skips the
 * history check fails closed rather than lending against a partial average.
 */
export function averageMonthlyIncome(
  bills: GreenLeafBill[],
  months = REQUIRED_MONTHS_OF_HISTORY,
): number {
  const window = settledBills(bills).slice(0, months);
  if (window.length < months) return 0;
  return floor2(window.reduce((sum, b) => sum + (b.grossAmount ?? 0), 0) / months);
}

/**
 * Advance ceiling: last settled rate/kg × **this** month's kilos.
 *
 * `requiredMonths` does not apply — an advance is against leaf already in the
 * shed, not against a track record.
 */
export function advanceCeiling(bills: GreenLeafBill[]): number {
  const ordered = billsNewestFirst(bills);
  const current = ordered[0];
  const settled = lastSettledBill(bills);
  if (!current || !settled?.totalRatePerKg) return 0;
  return floor2(settled.totalRatePerKg * current.totalKgs);
}

/** Loan ceiling: `LIMIT_MULTIPLIER` × average monthly income of the last 6 settled months. */
export function loanCeiling(
  bills: GreenLeafBill[],
  multiplier = LIMIT_MULTIPLIER,
  requiredMonths = REQUIRED_MONTHS_OF_HISTORY,
): number {
  if (monthsOfHistory(bills) < requiredMonths) return 0;
  return floor2(averageMonthlyIncome(bills, requiredMonths) * multiplier);
}

/** Manure ceiling: last settled rate/kg × **that** month's kilos. */
export function manureCeiling(
  bills: GreenLeafBill[],
  requiredMonths = REQUIRED_MONTHS_OF_HISTORY,
): number {
  if (monthsOfHistory(bills) < requiredMonths) return 0;
  const settled = lastSettledBill(bills);
  if (!settled?.totalRatePerKg) return 0;
  return floor2(settled.totalRatePerKg * settled.totalKgs);
}

/** Does the supplier meet the history requirement loans and manure share? */
export function hasRequiredHistory(
  bills: GreenLeafBill[],
  requiredMonths = REQUIRED_MONTHS_OF_HISTORY,
): boolean {
  return monthsOfHistory(bills) >= requiredMonths;
}
