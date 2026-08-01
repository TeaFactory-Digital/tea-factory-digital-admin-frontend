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
import { floor2, round2 } from './money';
import type { CreditEligibility } from './types/admin';
import type { CreditFacility, GreenLeafBill } from './types/app';

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

/** The ceiling for any facility, so a caller does not switch on three functions. */
export function creditCeiling(
  facility: CreditFacility,
  bills: GreenLeafBill[],
  multiplier = LIMIT_MULTIPLIER,
  requiredMonths = REQUIRED_MONTHS_OF_HISTORY,
): number {
  if (facility === 'advance') return advanceCeiling(bills);
  if (facility === 'loan') return loanCeiling(bills, multiplier, requiredMonths);
  return manureCeiling(bills, requiredMonths);
}

export interface CreditEligibilityInput {
  facility: CreditFacility;
  /** Every bill the supplier has, in any order. Newest is the month in progress. */
  bills: GreenLeafBill[];
  /** Already drawn on this facility and not yet repaid. */
  outstanding: number;
  /** Stamped by the caller — this module never reads the clock (see `bill.ts`). */
  computedAt: string;
  multiplier?: number;
  requiredMonths?: number;
}

/**
 * Why the supplier cannot draw, as an i18n key — or `null` when they can.
 *
 * Ordered so the **first** blocker is the one reported, and the order is the order
 * the office would explain it in: no track record beats no rate beats no leaf. A
 * screen that said "your ceiling is LKR 0" without saying which of the three
 * caused it sends the supplier to the counter to ask.
 */
function ineligibilityReasonKey(
  facility: CreditFacility,
  input: {
    monthsOfHistory: number;
    requiredMonths: number;
    settledRate: number | null;
    currentKgs: number;
    ceiling: number;
    available: number;
  },
): string | null {
  // An advance is against leaf already in the shed, not against a track record —
  // so the history rule does not apply to it, and applying it anyway would refuse
  // every new supplier the one facility that was designed for them.
  if (facility !== 'advance' && input.monthsOfHistory < input.requiredMonths) {
    return 'credit.reason.shortHistory';
  }
  // A loan is priced off income, not off a rate, so a missing auction result does
  // not block it (BR-102 is about the *figure* being null, not the supplier).
  if (facility !== 'loan' && !input.settledRate) return 'credit.reason.noSettledRate';
  if (facility === 'advance' && input.currentKgs <= 0) return 'credit.reason.noLeafThisMonth';
  if (input.ceiling <= 0) return 'credit.reason.noCeiling';
  if (input.available <= 0) return 'credit.reason.fullyDrawn';
  return null;
}

/**
 * The whole eligibility answer for one supplier and one facility — **the ceiling
 * and the working that reached it**.
 *
 * This is the function AC-05 is about. The supplier's app renders these figures
 * from `GET /advances|loans|manure/eligibility`, the console renders them in the
 * queue row and on the decision screen, and if the two disagree by a cent then
 * every rejection becomes an argument the office cannot win. There is one way to
 * make that impossible, and it is for both to call the same code.
 *
 * Pure and clock-free: `computedAt` is passed in. A module that read `Date.now()`
 * could not be tested for byte-for-byte agreement with anything.
 */
export function buildCreditEligibility({
  facility,
  bills,
  outstanding,
  computedAt,
  multiplier = LIMIT_MULTIPLIER,
  requiredMonths = REQUIRED_MONTHS_OF_HISTORY,
}: CreditEligibilityInput): CreditEligibility {
  const current = billsNewestFirst(bills)[0] ?? null;
  const settled = lastSettledBill(bills) ?? null;
  const months = monthsOfHistory(bills);

  const ceiling = creditCeiling(facility, bills, multiplier, requiredMonths);
  // `floor2`, not `round2`: this is a maximum, and rounding one up prints a limit
  // the validator on the other side rejects (money.ts → "ceilings truncate").
  const available = Math.max(0, floor2(ceiling - outstanding));

  const reasonKey = ineligibilityReasonKey(facility, {
    monthsOfHistory: months,
    requiredMonths,
    settledRate: settled?.totalRatePerKg ?? null,
    currentKgs: current?.totalKgs ?? 0,
    ceiling,
    available,
  });

  return {
    facility,
    ceiling,
    outstanding: round2(outstanding),
    available,
    eligible: reasonKey === null,
    reasonKey,

    monthsOfHistory: months,
    /** `0` for an advance — not "unset", but "no months are required". */
    requiredMonths: facility === 'advance' ? 0 : requiredMonths,
    averageMonthlyIncome:
      facility === 'loan' && months >= requiredMonths
        ? averageMonthlyIncome(bills, requiredMonths)
        : null,
    limitMultiplier: facility === 'loan' ? multiplier : null,
    lastSettledMonthKey: settled?.monthKey ?? null,
    lastSettledRatePerKg: settled?.totalRatePerKg ?? null,
    /**
     * Which kilos the rate was multiplied by, and the two facilities disagree:
     * an advance prices **this** month's leaf (it is cash against what is already
     * in the shed), manure prices the **last settled** month's. A loan is not
     * priced off kilos at all, so it is `null` rather than a number that would
     * invite the reader to check arithmetic that was never done.
     */
    pricedKgs:
      facility === 'advance'
        ? (current?.totalKgs ?? null)
        : facility === 'manure'
          ? (settled?.totalKgs ?? null)
          : null,
    computedAt,
  };
}
