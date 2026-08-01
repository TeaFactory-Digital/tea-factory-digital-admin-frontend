/**
 * Money and kilo arithmetic. Pure, and shared with the backend on purpose.
 *
 * The rule that makes this a package rather than a util file: **ceilings
 * truncate, amounts round** (api.md §16.2). A backend that rounds a ceiling up
 * produces a maximum the supplier cannot type — the app's inline validator
 * rejects the very figure the screen printed as the limit (BR-308). Sharing the
 * code is strictly better than re-deriving it on each side.
 */

import { MONEY_SCALE } from './constants';
import type { BillDeductions } from './types/app';

const FACTOR = 10 ** MONEY_SCALE;

/**
 * Truncate to cents. Use for every **ceiling** and every maximum.
 *
 * Never `round2` a limit: `floor2` makes the displayed maximum exactly the
 * maximum, so the number on screen is a number the validator accepts.
 */
export function floor2(value: number): number {
  return Math.floor(value * FACTOR) / FACTOR;
}

/** Round half-up to cents. Use for **amounts** — a payable figure, not a limit. */
export function round2(value: number): number {
  return Math.round(value * FACTOR) / FACTOR;
}

/**
 * A bill's deduction lines, or any subset of them.
 *
 * The union is what lets a caller pass a real `BillDeductions` **without a cast**.
 * `BillDeductions` is a closed interface, so it does not satisfy an index signature —
 * and a `Record<string, number>` parameter pushed an `as unknown as` onto every call
 * site, which is how a genuine type error hides among the noise of four fake ones.
 */
export type DeductionInput = BillDeductions | Readonly<Record<string, number>>;

/**
 * Sum the nine deduction lines.
 *
 * BR-107 requires the itemized lines to equal `total`. This exists so the
 * console can *check* that rather than trust it — a bill whose lines do not add
 * up is an M4 exception, and finding it after publishing is finding it too late.
 *
 * Sums every key except `total`, rather than the nine names: a backend that grows a
 * tenth line has to be caught disagreeing with its own total, not silently balanced
 * by a checker that ignored the new column.
 */
export function sumDeductionLines(deductions: DeductionInput): number {
  return round2(
    Object.entries(deductions as Record<string, number>)
      .filter(([key]) => key !== 'total')
      .reduce((sum, [, value]) => sum + value, 0),
  );
}

/** True when a bill's itemized deductions agree with its stated total (BR-107). */
export function deductionsBalance(deductions: DeductionInput & { total: number }): boolean {
  return Math.abs(sumDeductionLines(deductions) - deductions.total) < 1 / FACTOR;
}

/**
 * Mask an account number for display, keeping the last `visible` digits.
 *
 * A **display** helper only. The console never receives a full account number
 * in a list payload — the server masks it, and revealing one is a separate
 * audited call (§20.4). This exists for the reveal dialog and for locally
 * entered values before they are saved.
 */
export function maskAccountNumber(accountNumber: string, visible = 4): string {
  const digits = accountNumber.replace(/\s+/g, '');
  if (digits.length <= visible) return '•'.repeat(digits.length);
  return `${'•'.repeat(Math.max(4, digits.length - visible))}${digits.slice(-visible)}`;
}
