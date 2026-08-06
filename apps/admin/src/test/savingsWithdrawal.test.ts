/**
 * §21.9, as the factory answered it.
 *
 * *A supplier may take their savings out, normally in April; the month must be changeable;
 * interest is changeable and starts at 0%; the money is paid on the next Green Leaf
 * Account.* The last clause is the one that shapes this suite, because it means a
 * withdrawal is **not** a movement — it is a request that becomes a bill line that becomes
 * a passbook entry, and the interesting tests are the joins between those three.
 *
 * The case worth reading first is the **round trip**: ask in the window, generate a bill,
 * publish it, and only then does the balance move. A console that took the money out at
 * request time would pass every other test here and be wrong in the one way that matters —
 * it would tell a supplier their savings were gone a month before they were paid.
 *
 * Time is controlled with fake timers throughout, because the window is a real calendar
 * month: a suite that only passed in April would be a suite nobody could trust in May.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SAVINGS_POLICY,
  availableToWithdraw,
  colomboMonthKey,
  computeBillAmounts,
  isWithdrawalWindowOpen,
  round2,
  withdrawalProblems,
  type SavingsPolicy,
} from '@tfd/domain';
import { savingsRepository } from '@/services/repositories/savingsRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const ADMIN = 'factoryadmin@galabodatea.lk';

/** Mid-April, Colombo time — inside the default window. */
const IN_WINDOW = new Date('2026-04-15T06:00:00.000Z');
/** Mid-July — outside it. */
const OUT_OF_WINDOW = new Date('2026-07-15T06:00:00.000Z');

const APRIL: SavingsPolicy = DEFAULT_SAVINGS_POLICY;

describe('the withdrawal window', () => {
  afterEach(() => vi.useRealTimers());

  it('opens in the month the factory chose, and only that month', () => {
    expect(isWithdrawalWindowOpen(APRIL, IN_WINDOW)).toBe(true);
    expect(isWithdrawalWindowOpen(APRIL, OUT_OF_WINDOW)).toBe(false);

    // The factory that pays out in September changes a row, not a build.
    const september: SavingsPolicy = { withdrawalMonth: 9, annualInterestRate: 0 };
    expect(isWithdrawalWindowOpen(september, new Date('2026-09-02T00:00:00.000Z'))).toBe(true);
    expect(isWithdrawalWindowOpen(september, IN_WINDOW)).toBe(false);
  });

  /**
   * **Colombo-local, not the reader's clock** (BR-104).
   *
   * `2026-04-30T20:00:00Z` is the 1st of May in Colombo (+05:30). A console in London on
   * that instant must agree with the office that the window has shut — otherwise the last
   * evening of the window is a different length depending on who is looking.
   */
  it('turns over on the factory’s midnight, not the browser’s', () => {
    const lastEveningUtc = new Date('2026-04-30T20:00:00.000Z');
    expect(colomboMonthKey(lastEveningUtc)).toBe('2026-05');
    expect(isWithdrawalWindowOpen(APRIL, lastEveningUtc)).toBe(false);

    // And the reverse edge: still March in UTC, already April in Colombo.
    const firstMorning = new Date('2026-03-31T19:00:00.000Z');
    expect(colomboMonthKey(firstMorning)).toBe('2026-04');
    expect(isWithdrawalWindowOpen(APRIL, firstMorning)).toBe(true);
  });
});

describe('what a withdrawal is refused for', () => {
  const facts = (over: Partial<Parameters<typeof withdrawalProblems>[0]> = {}) => ({
    amount: 1000,
    balance: 5000,
    pendingTotal: 0,
    policy: APRIL,
    now: IN_WINDOW,
    ...over,
  });

  it('allows the ordinary case', () => {
    expect(withdrawalProblems(facts())).toEqual([]);
  });

  it('refuses out of season, whatever the figures say', () => {
    expect(withdrawalProblems(facts({ now: OUT_OF_WINDOW }))).toContain('window-closed');
  });

  /**
   * **A pending request reduces what may be asked for, not the balance.**
   *
   * The whole reason `availableToWithdraw` exists: a withdrawal does not move money until
   * the bill that pays it is published, so without this the same savings could be asked for
   * twice in one window and both requests would look fundable.
   */
  it('counts what is already waiting to be paid', () => {
    expect(availableToWithdraw(5000, 4000)).toBe(1000);
    expect(withdrawalProblems(facts({ amount: 1000, pendingTotal: 4000 }))).toEqual([]);
    expect(withdrawalProblems(facts({ amount: 1001, pendingTotal: 4000 }))).toContain(
      'exceeds-available',
    );
    // Never negative: two requests that together equal the balance leave nothing, not a debt.
    expect(availableToWithdraw(5000, 9000)).toBe(0);
  });

  it('refuses nothing, and refuses more than is held', () => {
    expect(withdrawalProblems(facts({ amount: 0 }))).toContain('not-positive');
    expect(withdrawalProblems(facts({ amount: -50 }))).toContain('not-positive');
    expect(withdrawalProblems(facts({ amount: 5000.01 }))).toContain('exceeds-available');
    expect(withdrawalProblems(facts({ balance: 0 }))).toContain('no-balance');
  });
});

describe('a withdrawal on the bill', () => {
  const base = {
    totalKgs: 100,
    ratePerKg: 120,
    extraRatePerKg: 0,
    coinsBroughtForward: 0,
    deductions: {
      transportCharges: 0, tea: 0, savings: 0, loansAdvance: 0, advance: 0,
      manure: 0, otherCards: 0, stamps: 0, previousDebts: 0,
    },
  };

  /**
   * The arithmetic decision: an **addition after the balance**, beside the coins.
   *
   * `balanceAmount` means "what the leaf earned, less what was taken off" — a supplier's own
   * savings coming back is neither, so folding it in would make the balance a figure nobody
   * could check against their kilos. It also keeps BR-107 intact: the nine deduction lines
   * still sum to their own total, because the withdrawal is not one of them.
   */
  it('adds to what is paid without touching the balance or the deductions', () => {
    const without = computeBillAmounts({ ...base, savingsWithdrawal: 0 });
    const with_ = computeBillAmounts({ ...base, savingsWithdrawal: 3000 });

    expect(with_.balanceAmount).toBe(without.balanceAmount);
    expect(with_.deductions.total).toBe(without.deductions.total);
    expect(with_.finalBalance).toBe(without.finalBalance! + 3000);
  });

  /**
   * A supplier with **no leaf at all** still gets paid.
   *
   * The direct consequence of paying withdrawals on the bill: zero kilos, zero gross, and
   * one payment. Without this the money would sit unpaid with nothing on any screen saying
   * why — see the note in `savings.ts`.
   */
  it('pays a withdrawal on an account with no leaf on it', () => {
    const amounts = computeBillAmounts({ ...base, totalKgs: 0, savingsWithdrawal: 2500 });
    expect(amounts.grossAmount).toBe(0);
    expect(amounts.finalBalance).toBe(2500);
    expect(amounts.nextMonthDeb).toBe(0);
  });

  /**
   * A withdrawal on an account that owes more than it earned **goes against the debt**.
   *
   * It falls out of the arithmetic rather than being a special case, and it is the
   * conservative reading: the factory does not hand cash to a supplier who owes it more
   * than the cash. Worth a test because the alternative — paying it and carrying the whole
   * debt — is equally arguable and would be a silent change if anybody reordered this.
   */
  it('offsets a debt rather than paying out over it', () => {
    const owing = {
      ...base,
      deductions: { ...base.deductions, previousDebts: 20_000 },
      savingsWithdrawal: 3000,
    };
    const amounts = computeBillAmounts(owing);

    // Gross 12,000 − 20,000 debt + 3,000 savings = −5,000.
    expect(amounts.finalBalance).toBe(0);
    expect(amounts.nextMonthDeb).toBe(5000);
  });

  it('waits for a rate rather than paying on an account with no figures', () => {
    const amounts = computeBillAmounts({
      ...base,
      ratePerKg: null,
      extraRatePerKg: null,
      savingsWithdrawal: 3000,
    });
    // Nothing payable, so nothing paid — the request stays pending for the account that
    // can carry it, rather than becoming a second payment for the same month.
    expect(amounts.finalBalance).toBeNull();
    expect(amounts.auctionResultAvailable).toBe(false);
  });
});

describe('M8 withdrawals against the mock API', () => {
  beforeEach(() => {
    signOut();
  });
  afterEach(() => vi.useRealTimers());

  /** A supplier who actually holds savings — otherwise the test asserts `no-balance`. */
  async function accountWithBalance() {
    const page = await savingsRepository.accounts({ pageSize: 50 });
    return page.items.find((one) => one.balance > 1000)!;
  }

  it('serves the factory’s policy, defaulted to the answer §21.9 gave', async () => {
    await signInAs(ACCOUNTANT);
    const account = await accountWithBalance();
    const state = await savingsRepository.withdrawals(account.supplierId);

    expect(state.policy.withdrawalMonth).toBe(4);
    // Recorded and never applied: the console posts no interest of its own.
    expect(state.policy.annualInterestRate).toBe(0);
    expect(state.balance).toBe(account.balance);
    expect(state.available).toBe(account.balance);
  }, 20_000);

  it('refuses out of season, from the server as well as the screen', async () => {
    vi.useFakeTimers({ now: OUT_OF_WINDOW, toFake: ['Date'] });
    await signInAs(ACCOUNTANT);
    const account = await accountWithBalance();
    const state = await savingsRepository.withdrawals(account.supplierId);

    expect(state.windowOpen).toBe(false);
    await expect(
      savingsRepository.requestWithdrawal(account.supplierId, 500, 'Asked at the counter', state),
    ).rejects.toMatchObject({ code: 'window-closed' });
  }, 20_000);

  it('insists on a reason, because the supplier will ask months later', async () => {
    vi.useFakeTimers({ now: IN_WINDOW, toFake: ['Date'] });
    await signInAs(ACCOUNTANT);
    const account = await accountWithBalance();

    // Past the repository's guard, the way a scripted client would arrive.
    await expect(
      savingsRepository.requestWithdrawal(account.supplierId, 500, 'short', {
        ...(await savingsRepository.withdrawals(account.supplierId)),
      }),
    ).rejects.toMatchObject({ code: 'note-required' });
  }, 20_000);

  it('gives a clerk the passbook and refuses them the withdrawal (§12.1)', async () => {
    vi.useFakeTimers({ now: IN_WINDOW, toFake: ['Date'] });
    await signInAs(CLERK);
    const account = await accountWithBalance();

    // `billing: read` — the clerk may look.
    const state = await savingsRepository.withdrawals(account.supplierId);
    expect(state.balance).toBeGreaterThan(0);

    // …and not move it. "Bills & savings" is `W` for the accountant.
    await expect(
      savingsRepository.requestWithdrawal(account.supplierId, 100, 'Counter request today', state),
    ).rejects.toMatchObject({ code: 'forbidden' });
  }, 20_000);

  /**
   * **The round trip, and the reason the whole module is shaped this way.**
   *
   * Ask → the balance is unchanged → the bill carries it → publish → *now* the passbook
   * moves. Each arrow is a place a simpler implementation would have taken the money early,
   * and every one of those would tell a supplier their savings were gone before they were.
   */
  it('moves nothing until the account that pays it is published', async () => {
    vi.useFakeTimers({ now: IN_WINDOW, toFake: ['Date'] });
    await signInAs(ACCOUNTANT);

    const account = await accountWithBalance();
    const before = account.balance;
    const amount = 500;

    const state = await savingsRepository.withdrawals(account.supplierId);
    await savingsRepository.requestWithdrawal(
      account.supplierId,
      amount,
      'Asked for at the counter in April',
      state,
    );

    // 1. Nothing has moved. The balance is what it was.
    const afterRequest = await savingsRepository.withdrawals(account.supplierId);
    expect(afterRequest.balance).toBe(before);
    expect(afterRequest.pendingTotal).toBe(amount);
    expect(afterRequest.available).toBe(round2(before - amount));

    /**
     * 2. Close the open month for real, and its run picks the withdrawal up.
     *
     * The whole M4 path rather than a shortcut, because that is the only way the assertion
     * below means anything: a bill line that appeared without a rate, without the exceptions
     * cleared and without a second person publishing would not be a bill anybody was given.
     */
    vi.useRealTimers();
    const months = await billRepository.months();
    const open = months.find((month) => month.open)!;

    await monthRepository.setRate(open.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    const exceptions = await monthRepository.exceptions(open.monthKey, { resolved: false });
    for (const exception of exceptions.items) {
      await monthRepository.resolveException(
        open.monthKey,
        exception.id,
        'Checked against the counter records and accepted for this month.',
      );
    }

    const run = await billRepository.generate(open.monthKey);
    expect(run.billCount).toBeGreaterThan(0);

    const bills = await billRepository.list({ monthKey: open.monthKey, pageSize: 500 });
    const theirs = bills.items.find((bill) => bill.supplierId === account.supplierId)!;
    const detail = await billRepository.get(theirs.id);
    expect(detail.savingsWithdrawal).toBe(amount);

    // 3. Still nothing in the passbook — a generated bill is not a given one.
    const beforePublish = await savingsRepository.withdrawals(account.supplierId);
    expect(beforePublish.balance).toBe(before);

    // 4. Publish, and only now does the balance move.
    signOut();
    await signInWithMfaAs('manager@galabodatea.lk');
    await monthRepository.publish(open.monthKey, 'Published for the withdrawal round trip');

    /**
     * Publishing moves the passbook **twice**, in opposite directions, and the assertion has
     * to say so: this month's savings deduction goes in as a contribution, and the
     * withdrawal comes out. Asserting only the withdrawal would have been asserting that
     * publishing does *not* credit savings, which is M8's oldest rule.
     */
    const contribution = detail.deductions.savings;
    const expected = round2(before + contribution - amount);

    const afterPublish = await savingsRepository.withdrawals(account.supplierId);
    expect(afterPublish.balance).toBe(expected);
    expect(afterPublish.pendingTotal).toBe(0);
    expect(afterPublish.items[0]!.status).toBe('settled');
    expect(afterPublish.items[0]!.settledMonthKey).toBe(open.monthKey);

    // The passbook carries it as a **negative** entry, which is what the shared type says a
    // withdrawal is — so the running balance needs no special case.
    const ledger = await savingsRepository.ledger(account.supplierId);
    const entry = ledger.items.find((one) => one.source === 'withdrawal')!;
    expect(entry.amount).toBe(-amount);
    expect(entry.balance).toBe(expected);
    // The contribution for the same month is there too, and it is a separate row: one
    // netted entry would hide half of what happened from a supplier reading the book.
    expect(
      ledger.items.filter((one) => one.monthKey === open.monthKey).map((one) => one.source).sort(),
    ).toEqual(['billDeduction', 'withdrawal']);

    // And the registry agrees with the ledger, which is AC-01's rule for every figure.
    const supplier = await supplierRepository.get(account.supplierId);
    expect(supplier.savingsBalance).toBe(expected);
  }, 60_000);

  it('cancels rather than deletes, because the supplier was told it was arranged', async () => {
    vi.useFakeTimers({ now: IN_WINDOW, toFake: ['Date'] });
    await signInAs(ACCOUNTANT);
    const account = await accountWithBalance();

    const state = await savingsRepository.withdrawals(account.supplierId);
    const request = await savingsRepository.requestWithdrawal(
      account.supplierId,
      250,
      'Recorded in error at the counter',
      state,
    );
    await savingsRepository.cancelWithdrawal(request.id, 'Supplier changed their mind');

    const after = await savingsRepository.withdrawals(account.supplierId);
    // Still on the record — a cancelled request is a thing that happened.
    expect(after.items.find((one) => one.id === request.id)!.status).toBe('cancelled');
    expect(after.pendingTotal).toBe(0);
    // …and the next bill no longer carries it.
    expect(after.available).toBe(after.balance);
  }, 30_000);

  it('audits both the request and the cancellation (AC-09)', async () => {
    vi.useFakeTimers({ now: IN_WINDOW, toFake: ['Date'] });
    await signInAs(ACCOUNTANT);
    const account = await accountWithBalance();

    const state = await savingsRepository.withdrawals(account.supplierId);
    const request = await savingsRepository.requestWithdrawal(
      account.supplierId,
      300,
      'April withdrawal, audited',
      state,
    );
    await savingsRepository.cancelWithdrawal(request.id, 'Cancelled for the audit test');

    vi.useRealTimers();
    const audit = await auditRepository.list({ entity: 'supplier', entityId: account.supplierId });
    const actions = audit.items.map((one) => one.action);
    expect(actions).toContain('savings.withdrawal.request');
    expect(actions).toContain('savings.withdrawal.cancel');
  }, 30_000);

  /**
   * The factory's other answer: **the month is changeable.**
   *
   * Asserted end to end rather than as a unit, because the value has to travel from M14's
   * form to the refusal — a policy the console stored and the server ignored would look
   * identical on the configuration screen.
   */
  it('follows the month the factory set, not the April default', async () => {
    vi.useFakeTimers({ now: OUT_OF_WINDOW, toFake: ['Date'] });

    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch(
      { savings: { perKgOptions: config.savings.perKgOptions, withdrawalMonth: 7 } },
      config,
      usage,
    );

    signOut();
    await signInAs(ACCOUNTANT);
    const account = await accountWithBalance();
    const state = await savingsRepository.withdrawals(account.supplierId);

    // July, which was shut a moment ago and is now the window.
    expect(state.policy.withdrawalMonth).toBe(7);
    expect(state.windowOpen).toBe(true);
    await expect(
      savingsRepository.requestWithdrawal(account.supplierId, 100, 'July window, as set', state),
    ).resolves.toMatchObject({ status: 'pending' });
  }, 30_000);
});
