/**
 * M8's savings policy — **§21.9, answered by the factory.**
 *
 * The answer, in the factory's words: *a supplier may take their savings out, normally in
 * April, but the month must be changeable; interest is changeable too, and starts at 0% a
 * year.* Everything here follows from that, and the parts the factory did **not** say are
 * left undone rather than guessed:
 *
 *  - **The month is configuration**, defaulting to April. A factory that pays out at the
 *    start of the school year rather than at Aluth Avurudu changes a row, not a build.
 *  - **The rate is configuration**, defaulting to `0`. It is *stored and shown and never
 *    acted on*: nobody has said whether interest is simple or compound, or whether it is
 *    paid on the closing balance or the year's minimum — and those give materially
 *    different money. So the console posts no interest of its own. When the factory decides,
 *    the accountant posts an `interest` entry with the figure they decided, and the ledger
 *    already has that word in its vocabulary.
 *
 * **A withdrawal is paid on the next bill** (the factory's choice), which is why nothing in
 * this file moves money. It records an *intention* — checked against the balance and the
 * window — and M5 turns it into a line on the Green Leaf Account. Two consequences worth
 * knowing, both of which fall out of that decision rather than being invented here:
 *
 *  1. **The balance does not drop when the withdrawal is asked for.** The savings ledger is
 *     derived from *published* bills and nothing else, and a second rule for withdrawals
 *     would be a second answer to "what is this supplier's balance". So a pending
 *     withdrawal is subtracted from what may be asked for again (`availableToWithdraw`),
 *     not from the balance itself.
 *  2. **A supplier with no leaf that month still gets a bill**, because otherwise their
 *     withdrawal has nothing to be paid on. M5 generates for anyone with a pending
 *     withdrawal, and the account reads zero kilos and one payment.
 */

import { round2 } from './money';

/* ────────────────────────────── the policy ────────────────────────────── */

export interface SavingsPolicy {
  /**
   * The calendar month withdrawals may be asked for, `1`–`12`.
   *
   * April by default — the factory's own answer, and the month a smallholder household
   * needs money for the new year.
   */
  withdrawalMonth: number;
  /**
   * Annual interest, as a percentage. `0` by default, and **the console never applies it**
   * — see the note at the top of this file. It is here so a factory can record what it
   * pays, and so the screen can show a supplier's expectation, not so anything accrues.
   */
  annualInterestRate: number;
}

export const DEFAULT_SAVINGS_POLICY: SavingsPolicy = {
  withdrawalMonth: 4,
  annualInterestRate: 0,
};

/** A month number the picker can offer. Rejected rather than clamped: 13 is a typo. */
export function isWithdrawalMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

/** A rate a factory could plausibly pay. Negative interest is a charge, not a rate. */
export function isInterestRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/* ────────────────────────────── the window ────────────────────────────── */

const colomboMonthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: '2-digit',
});

/**
 * The `YYYY-MM` the factory is currently in, Colombo-local (BR-104).
 *
 * Not the browser's month: a console open in another timezone on the 1st or the 31st would
 * otherwise decide the window was shut when the office says it is open, or the reverse.
 */
export function colomboMonthKey(instant: Date): string {
  return colomboMonthFormat.format(instant).slice(0, 7);
}

/** Is this the month the factory pays savings out in? */
export function isWithdrawalWindowOpen(policy: SavingsPolicy, now: Date): boolean {
  return Number(colomboMonthKey(now).slice(5, 7)) === policy.withdrawalMonth;
}

/**
 * What may still be asked for.
 *
 * The balance **less what is already pending**, because a withdrawal does not reduce the
 * balance until the bill it is paid on is published — so without this, a supplier could ask
 * for their whole balance twice in one window and the second request would look fundable.
 */
export function availableToWithdraw(balance: number, pendingTotal: number): number {
  return Math.max(0, round2(balance - pendingTotal));
}

/* ────────────────────────────── the refusals ────────────────────────────── */

export type WithdrawalProblem =
  | 'window-closed'
  | 'not-positive'
  | 'exceeds-available'
  | 'no-balance';

export interface WithdrawalRequestFacts {
  amount: number;
  balance: number;
  /** Already asked for this window and not yet paid. */
  pendingTotal: number;
  policy: SavingsPolicy;
  now: Date;
}

/**
 * Everything wrong with a withdrawal, shared so the screen withholds the control and the
 * server refuses with the same rule.
 *
 * All of them block. This is a supplier's own money and the failure modes are paying out
 * more than is held, or paying out in a month the factory has not budgeted for — neither is
 * something to warn about and proceed with.
 */
export function withdrawalProblems(facts: WithdrawalRequestFacts): WithdrawalProblem[] {
  const problems: WithdrawalProblem[] = [];
  const available = availableToWithdraw(facts.balance, facts.pendingTotal);

  if (!isWithdrawalWindowOpen(facts.policy, facts.now)) problems.push('window-closed');
  if (facts.balance <= 0) problems.push('no-balance');
  if (!(facts.amount > 0)) problems.push('not-positive');
  else if (round2(facts.amount) > available) problems.push('exceeds-available');

  return problems;
}

export function canWithdraw(facts: WithdrawalRequestFacts): boolean {
  return withdrawalProblems(facts).length === 0;
}

/* ────────────────────────────── the record ────────────────────────────── */

/**
 * `pending` until the bill that pays it is published, then `settled`.
 *
 * No `paid` distinct from `settled`: the money leaves with the rest of the bill, through
 * whichever payout method the supplier is on, so a separate payment state here would be a
 * second place to look for an answer M6 already owns.
 */
export type SavingsWithdrawalStatus = 'pending' | 'settled' | 'cancelled';

export interface SavingsWithdrawal {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  amount: number;
  status: SavingsWithdrawalStatus;
  /** Colombo-local `YYYY-MM` the request was made in — the window it belongs to. */
  requestedMonth: string;
  requestedAt: string;
  requestedByName: string;
  /** Why. Mandatory, like every other movement of somebody else's money in this console. */
  reason: string;
  /** The bill it was paid on, once one has been published. */
  settledBillId: string | null;
  settledMonthKey: string | null;
}

/**
 * What `GET /admin/savings/accounts/{id}/withdrawals` answers.
 *
 * In the domain package rather than beside the endpoint, for the reason every wire shape
 * is: **the API implements it too.** A type invented in `apps/admin` is a DTO the backend
 * can drift from — and `windowOpen` in particular has to be the *server's* answer, because
 * it depends on the factory's Colombo-local month and not on the reader's clock.
 */
export interface SavingsWithdrawalState {
  policy: SavingsPolicy;
  windowOpen: boolean;
  balance: number;
  pendingTotal: number;
  /** Balance less what is already pending — the figure a new request is checked against. */
  available: number;
  items: SavingsWithdrawal[];
}

/** What a supplier is owed from their savings on a given month's bill. */
export function pendingWithdrawalTotal(withdrawals: readonly SavingsWithdrawal[]): number {
  return round2(
    withdrawals
      .filter((one) => one.status === 'pending')
      .reduce((sum, one) => sum + one.amount, 0),
  );
}
