/**
 * Corrections: a balance or a payment found wrong after a bill was published.
 *
 * **Decided by the factory (C5, built 30 October 2026):** a published bill is never edited.
 * A manager posts a correction with a reason, and it is applied **forward**:
 *
 *  - **A balance** (`loan`, `manure`, `savings`) is corrected at once, as an `adjustment`
 *    entry in that ledger. The next bill carries the corrected balance forward.
 *  - **A payment** (`payment`) lands on the supplier's **next** bill as a line headed
 *    "Correction", with the month it corrects and the reason: added to what is paid when the
 *    supplier was paid too little, taken off when they were paid too much. It is added after
 *    the balance, like a savings withdrawal (`computeBillAmounts`), so the nine deduction
 *    lines still add up to their own total (BR-107).
 *
 * Only the manager (`billing: A`). A correction is never deleted: a wrong one is corrected by
 * another, the other way. Every one is in the audit trail.
 *
 * Not for the factory's own system's figures: where the bills are **imported**, a payment
 * correction belongs in that system and arrives on its next slip (`payment-bills-imported`),
 * and a balance corrected here is put back to the slip's figure by the next import unless
 * the factory's system makes the same correction.
 */

import { round2 } from './money';
import type { BillCorrection } from './types/app';

/** What is corrected. `advance` and `teaPackets` carry no balance: each is taken in full. */
export const CORRECTION_TARGETS = ['payment', 'loan', 'manure', 'savings'] as const;
export type CorrectionTarget = (typeof CORRECTION_TARGETS)[number];

/** The ledgers a correction moves at once; `payment` waits for the next bill. */
export const BALANCE_CORRECTION_TARGETS: readonly CorrectionTarget[] = ['loan', 'manure', 'savings'];

/**
 * What the manager types.
 *
 * `amount` is **signed, as the supplier sees it**:
 *  - `payment`: `+` the supplier was paid too little (added to the next bill), `-` too much
 *    (taken off it);
 *  - `loan`, `manure`: `+` they owe more, `-` they owe less;
 *  - `savings`: `+` they hold more, `-` they hold less.
 */
export interface NewSupplierCorrection {
  target: CorrectionTarget;
  amount: number;
  /** The published month the mistake was on, `YYYY-MM`. */
  correctsMonthKey: string;
  /** Shown to the supplier on the bill for a payment; kept in the audit for every one. */
  reason: string;
}

export interface SupplierCorrection extends NewSupplierCorrection {
  id: string;
  supplierId: string;
  createdAt: string;
  createdByName: string;
  /**
   * `applied` once it has moved money: at once for a balance, when the bill carrying it is
   * published for a payment. `pending` is a payment waiting for that bill.
   */
  status: 'pending' | 'applied';
  /** The bill a payment correction was paid or taken on, once published. */
  appliedBillId: string | null;
  appliedMonthKey: string | null;
}

/** What `GET /admin/suppliers/{id}/corrections` answers, newest first. */
export interface SupplierCorrections {
  items: SupplierCorrection[];
  /** The months with a published bill for this supplier, newest first: what may be corrected. */
  publishedMonthKeys: string[];
  /** Where this factory's bills come from: a payment correction needs them calculated here. */
  billSource: 'imported' | 'calculated';
}

export const CORRECTION_REASON_MIN = 10;

export type CorrectionProblem =
  | 'amount-zero'
  | 'reason-short'
  | 'month-not-published'
  | 'below-zero'
  | 'payment-bills-imported';

export interface CorrectionFacts {
  /** Months with a published bill for the supplier. */
  publishedMonthKeys: readonly string[];
  /** The balances now, for `below-zero`. */
  balances: { loan: number; manure: number; savings: number };
  billSource: 'imported' | 'calculated';
}

/**
 * Everything wrong with a correction, shared so the form withholds the button and the server
 * refuses with the same rule (`422 correction-invalid`, `details.problems`).
 *
 * `below-zero`: a loan, fertilizer or savings balance cannot be corrected below nothing. A
 * supplier who repaid more than they owed was paid too little, which is a `payment`.
 */
export function correctionProblems(input: NewSupplierCorrection, facts: CorrectionFacts): CorrectionProblem[] {
  const problems: CorrectionProblem[] = [];
  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount === 0) problems.push('amount-zero');
  if (input.reason.trim().length < CORRECTION_REASON_MIN) problems.push('reason-short');
  if (!facts.publishedMonthKeys.includes(input.correctsMonthKey)) problems.push('month-not-published');
  if (input.target === 'payment') {
    if (facts.billSource === 'imported') problems.push('payment-bills-imported');
  } else if (Number.isFinite(amount) && round2(facts.balances[input.target] + amount) < 0) {
    problems.push('below-zero');
  }
  return problems;
}

/** The net of a bill's correction lines: what `computeBillAmounts` adds after the balance. */
export function correctionTotal(lines: readonly BillCorrection[] | null | undefined): number {
  return round2((lines ?? []).reduce((sum, line) => sum + line.amount, 0));
}
