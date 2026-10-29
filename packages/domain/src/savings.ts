/**
 * M8's savings policy: **§21.9, answered by the factory.**
 *
 * The answer, in the factory's words: *a supplier may take their savings out, normally in
 * April, but the month must be changeable; interest is changeable too, and starts at 0% a
 * year.* Everything here follows from that, and the parts the factory did **not** say are
 * left undone rather than guessed:
 *
 *  - **The month is configuration**, defaulting to April. A factory that pays out at the
 *    start of the school year rather than at Aluth Avurudu changes a row, not a build.
 *  - **The rate is configuration**, defaulting to `0`. How it is applied was decided on
 *    29 October 2026: simple interest on each month's lowest balance, credited once a year
 *    in time for the withdrawal month (`savingsInterestFor`, below). The API posts it as an
 *    `interest` entry, a word the ledger already has; until it does, the accountant posts
 *    the figure this function gives.
 *
 * **A withdrawal is paid on the next bill** (the factory's choice), which is why nothing in
 * this file moves money. It records an *intention*, checked against the balance and the
 * window, and M5 turns it into a line on the Green Leaf Account. Two consequences worth
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
import type { SavingsEntrySource } from './types/admin';

/* ────────────────────────────── the policy ────────────────────────────── */

export interface SavingsPolicy {
  /**
   * The calendar month withdrawals may be asked for, `1`–`12`.
   *
   * April by default: the factory's own answer, and the month a smallholder household
   * needs money for the new year.
   */
  withdrawalMonth: number;
  /**
   * Annual interest, as a percentage. `0` by default. Applied by `savingsInterestFor`:
   * simple, on each month's lowest balance, credited once a year before the withdrawal
   * month.
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
 * balance until the bill it is paid on is published, so without this, a supplier could ask
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
 * more than is held, or paying out in a month the factory has not budgeted for; neither is
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
  /** Colombo-local `YYYY-MM` the request was made in: the window it belongs to. */
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
 * can drift from, and `windowOpen` in particular has to be the *server's* answer, because
 * it depends on the factory's Colombo-local month and not on the reader's clock.
 */
export interface SavingsWithdrawalState {
  policy: SavingsPolicy;
  windowOpen: boolean;
  balance: number;
  pendingTotal: number;
  /** Balance less what is already pending: the figure a new request is checked against. */
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

/* ────────────────────────────── interest ────────────────────────────── */

/** `"2026-04"` moved by `by` months: `shiftMonthKey('2026-01', -1)` is `"2025-12"`. */
function shiftMonthKey(monthKey: string, by: number): string {
  const index = Number(monthKey.slice(0, 4)) * 12 + Number(monthKey.slice(5, 7)) - 1 + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * The twelve months one year's interest is for, and the month it is credited with.
 *
 * **Decided 29 October 2026: credited in time for the withdrawal month.** The year runs to
 * the month **before** the withdrawal month and is posted with that month, when its bills
 * are published (the first days of the withdrawal month), so the interest is in the balance
 * a supplier may take out. With April: April 2026 to March 2027, credited with March 2027,
 * withdrawable in April 2027.
 *
 * `creditYear` is the year of the withdrawal window the interest is for.
 */
export function interestYear(
  policy: Pick<SavingsPolicy, 'withdrawalMonth'>,
  creditYear: number,
): { fromMonthKey: string; toMonthKey: string } {
  const window = `${creditYear}-${String(policy.withdrawalMonth).padStart(2, '0')}`;
  const toMonthKey = shiftMonthKey(window, -1);
  return { fromMonthKey: shiftMonthKey(toMonthKey, -11), toMonthKey };
}

/** One month of a year's interest, so the passbook can show its working. */
export interface SavingsInterestMonth {
  monthKey: string;
  /** Balance before the month's entries. */
  opening: number;
  /** Balance after them: the month's contribution and any withdrawal paid on its bill. */
  closing: number;
  /** The lower of the two, never below zero: what earned interest. */
  base: number;
  /** Percentage a year in force that month. */
  annualRate: number;
  /** `base × annualRate ÷ 100 ÷ 12`, to the cent. */
  interest: number;
}

export interface SavingsInterestYearResult {
  fromMonthKey: string;
  toMonthKey: string;
  months: SavingsInterestMonth[];
  /** The sum of the months: the `interest` entry to post with `toMonthKey`. */
  total: number;
}

/** A ledger movement as this needs it: the app's row, or the console's with its source. */
export interface SavingsInterestEntry {
  monthKey: string;
  amount: number;
  source?: SavingsEntrySource;
}

/**
 * One supplier's interest for one year. **Decided by the factory on 29 October 2026:**
 *
 *  - **Simple.** A month earns `base × rate ÷ 12`; nothing earned in the year earns interest
 *    in that year. Once credited it is the supplier's money like any other (they may
 *    withdraw it), so it is in the balance from the next year on.
 *  - **On the month's lowest balance.** The lower of the balance before the month's entries
 *    and after them. Contributions are posted when the month's bill is published, after the
 *    month, so in an ordinary month that is the opening balance: the money that sat in the
 *    account all month. In the month a withdrawal is paid it is the balance after it, so
 *    money taken out earns nothing that month. Never below zero.
 *  - **Credited once a year** for the months `interestYear` gives.
 *
 * Each month is rounded to the cent and the total is their sum, so the working adds up on
 * paper. `annualRate` is a percentage, or a function giving the rate in force in a month,
 * for a factory that changed it during the year. An `interest` entry inside the year is
 * left out, so working it out again after it was posted gives the same answer.
 */
export function savingsInterestFor(
  entries: readonly SavingsInterestEntry[],
  year: { fromMonthKey: string; toMonthKey: string },
  annualRate: number | ((monthKey: string) => number),
): SavingsInterestYearResult {
  const rateFor = typeof annualRate === 'function' ? annualRate : () => annualRate;
  const counted = entries.filter(
    (one) =>
      !(one.source === 'interest' && one.monthKey >= year.fromMonthKey && one.monthKey <= year.toMonthKey),
  );
  const before = (monthKey: string) =>
    round2(counted.filter((one) => one.monthKey < monthKey).reduce((sum, one) => sum + one.amount, 0));

  const months: SavingsInterestMonth[] = [];
  for (let monthKey = year.fromMonthKey; monthKey <= year.toMonthKey; monthKey = shiftMonthKey(monthKey, 1)) {
    const opening = before(monthKey);
    const closing = before(shiftMonthKey(monthKey, 1));
    const base = Math.max(0, Math.min(opening, closing));
    const rate = rateFor(monthKey);
    months.push({ monthKey, opening, closing, base, annualRate: rate, interest: round2((base * rate) / 100 / 12) });
  }
  return { ...year, months, total: round2(months.reduce((sum, one) => sum + one.interest, 0)) };
}
