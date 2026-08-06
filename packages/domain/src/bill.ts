/**
 * Green Leaf Account arithmetic — the shared half of M5.
 *
 * Shared for the reason `leafCredit.ts` is shared, only more so: **AC-03 requires
 * the console, the printed slip and the app's Home screen to agree field for
 * field.** A bill is a read model over delivery rows and a monthly rate (api.md
 * §16), so three implementations of the same derivation are three figures the
 * office reconciles by hand — and they reconcile it after the supplier has
 * already been handed a slip.
 *
 * Four rules travel with these functions:
 *
 *  - **`null` is not `0`** (BR-102). Without an auction rate every rate-derived
 *    amount is `null`, and the app renders a blank rather than a figure the office
 *    would have to explain.
 *  - **Amounts round, ceilings truncate** (§16.2). Every figure here is an amount,
 *    so every one of them uses `round2`.
 *  - **The itemized lines are the truth, the total is derived** (BR-107). `total`
 *    is recomputed from the nine lines rather than trusted, because a stated total
 *    that disagrees with its own lines is the one error nobody spots on a slip.
 *  - **The factory pays whole rupees.** The sub-rupee remainder is the slip's
 *    "coins" line and it carries into the next account — which is what
 *    `coinsBroughtForward` and `coinsCarriedForward` are for, and why neither is
 *    ever `null`.
 */

import { round2, sumDeductionLines } from './money';
import type { BillDeductions } from './types/app';

/** The nine itemized lines, before their total is derived from them. */
export type DeductionLines = Omit<BillDeductions, 'total'>;

/**
 * What a bill is built from: a month's kilos for one supplier, the month's rate,
 * and the deductions the office holds against them.
 */
export interface BillFacts {
  totalKgs: number;
  /** `null` while the auction result is not in (BR-102). */
  ratePerKg: number | null;
  /** The extra the factory adds. `0` is a real answer; `null` tracks `ratePerKg`. */
  extraRatePerKg: number | null;
  /** Cents the previous account could not pay in whole rupees. */
  coinsBroughtForward: number;
  /**
   * Savings asked back this month and paid on this account (§21.9). `0` when none.
   *
   * A fact rather than something derived here: which withdrawals are outstanding is M8's
   * question, and a bill that decided it for itself would be a second answer.
   */
  savingsWithdrawal: number;
  deductions: DeductionLines;
}

/** Every figure the slip prints that is *derived* rather than held. */
export interface BillAmounts {
  auctionResultAvailable: boolean;
  totalRatePerKg: number | null;
  greenLeafAmount: number | null;
  extraPayment: number | null;
  grossAmount: number | null;
  /** The nine lines with their total recomputed (BR-107). */
  deductions: BillDeductions;
  balanceAmount: number | null;
  /** Sub-rupee remainder held back for the next account. Never `null`. */
  coinsCarriedForward: number;
  /** Whole rupees the factory pays. `0` when the account owes more than it earned. */
  finalBalance: number | null;
  /** The unpaid negative balance, carried into next month's account as debt. */
  nextMonthDeb: number;
}

/** The nine lines, totalled. Exposed because a caller often needs it alone. */
export function totalDeductions(lines: DeductionLines): BillDeductions {
  return { ...lines, total: sumDeductionLines(lines) };
}

/**
 * The savings deducted from a month's account.
 *
 * One line, and it is also M8's only inbound movement: a savings contribution *is*
 * this deduction on a published bill. Two write paths for one fact would be two
 * balances for the office to reconcile.
 */
export function savingsDeductionFor(totalKgs: number, savingsPerKg: number): number {
  return round2(totalKgs * savingsPerKg);
}

/**
 * Derive every rate-dependent figure on the slip.
 *
 * The order below is the order the printed account reads in, deliberately: anyone
 * checking the console against a slip is reading top to bottom, and a function
 * that computed the final balance first would be harder to check than the paper.
 */
export function computeBillAmounts(facts: BillFacts): BillAmounts {
  const deductions = totalDeductions(facts.deductions);

  /**
   * No rate is a *state*, not a zero (BR-102).
   *
   * The deductions are still real — the office holds them whatever the auction
   * did — but nothing is payable, so the coins carry on untouched rather than
   * being spent against a balance that does not exist yet.
   */
  if (facts.ratePerKg === null || facts.extraRatePerKg === null) {
    /**
     * A withdrawal waits for a rate too, and that is the honest answer rather than the
     * kind one. It could be paid now — it is the supplier's own money and owes nothing to
     * the auction — but paying it on an account with no figures on it would mean a second
     * payment for the same month once the rate lands, and M6 builds one run per month per
     * method. So the request stays pending and lands on the account that can carry it.
     */
    return {
      auctionResultAvailable: false,
      totalRatePerKg: null,
      greenLeafAmount: null,
      extraPayment: null,
      grossAmount: null,
      deductions,
      balanceAmount: null,
      coinsCarriedForward: round2(facts.coinsBroughtForward),
      finalBalance: null,
      nextMonthDeb: 0,
    };
  }

  const greenLeafAmount = round2(facts.totalKgs * facts.ratePerKg);
  const extraPayment = round2(facts.totalKgs * facts.extraRatePerKg);
  const grossAmount = round2(greenLeafAmount + extraPayment);
  const balanceAmount = round2(grossAmount - deductions.total);
  /**
   * The withdrawal joins **after** the balance, with the coins.
   *
   * `balanceAmount` means "what the leaf earned, less what was taken off", and a supplier's
   * own savings coming back is neither. Keeping it out of that figure is what lets the slip
   * print a balance a supplier can check against their kilos.
   */
  const payable = round2(balanceAmount + facts.coinsBroughtForward + facts.savingsWithdrawal);

  /**
   * An account that owes more than it earned pays nothing and carries the
   * shortfall (`nextMonthDeb`).
   *
   * Stated as its own branch rather than falling out of the arithmetic, because
   * the alternative reaches a payout run as a negative line — which a bank file
   * cannot express and a cheque cannot be written for.
   */
  if (payable <= 0) {
    return {
      auctionResultAvailable: true,
      totalRatePerKg: round2(facts.ratePerKg + facts.extraRatePerKg),
      greenLeafAmount,
      extraPayment,
      grossAmount,
      deductions,
      balanceAmount,
      coinsCarriedForward: 0,
      finalBalance: 0,
      nextMonthDeb: round2(-payable),
    };
  }

  // Whole rupees out, cents held back. `Math.floor` rather than `floor2`: the
  // granularity here is a rupee, not a cent.
  const finalBalance = Math.floor(payable);

  return {
    auctionResultAvailable: true,
    totalRatePerKg: round2(facts.ratePerKg + facts.extraRatePerKg),
    greenLeafAmount,
    extraPayment,
    grossAmount,
    deductions,
    balanceAmount,
    coinsCarriedForward: round2(payable - finalBalance),
    finalBalance,
    nextMonthDeb: 0,
  };
}

/**
 * `"2026-04"` → `"APRIL 2026"`, the slip's own month heading.
 *
 * Upper case and English because that is what the printed Green Leaf Account says
 * — this is a **document field**, not console chrome, so it does not go through
 * `t()`. The console's own month labels are formatted from `monthKey` (BR-110).
 */
const SLIP_MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

export function slipMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const name = SLIP_MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year}` : monthKey;
}

/**
 * The bill number as the slip prints it: `GL/2026-04/0042`.
 *
 * Derived from the month and a sequence within it rather than from a global
 * counter, because the office quotes a bill number over the telephone and needs
 * to be able to tell which month it belongs to without looking it up.
 */
export function billNumberFor(monthKey: string, sequence: number): string {
  return `GL/${monthKey}/${String(sequence).padStart(4, '0')}`;
}
