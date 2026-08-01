/**
 * M8 against the mock API.
 *
 * The module is read-only, so this suite is about the one property that makes it
 * trustworthy: **every figure ties to a published bill.** A savings balance is the sum
 * of the `savings` deduction lines on the bills a supplier has actually been given, and
 * there is no second way to move it. If those two ever disagree, the supplier's
 * passbook and their slip disagree — which is the conversation the module exists to
 * make impossible.
 *
 * So the assertions are mostly identities:
 *
 *  - the account balance equals the last ledger entry's running balance;
 *  - the running balance equals the opening balance plus every contribution;
 *  - each contribution equals its bill's savings deduction;
 *  - the registry's `savingsBalance` (M2) equals the ledger's (AC-01);
 *  - a month's factory total equals the sum of that month's contributions.
 *
 * Plus the two things the module deliberately does not do — no withdrawal and no
 * interest path exists (§21.9) — and the AC-07 half that a flag turns an **endpoint**
 * off, not only a sidebar row.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { round2 } from '@tfd/domain';
import { billRepository } from '@/services/repositories/billRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { savingsRepository } from '@/services/repositories/savingsRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const WEIGHER = 'weigher@galabodatea.lk';

describe('M8 savings', () => {
  beforeEach(() => {
    signOut();
  });

  it('summarises the scheme as a liability, with an oldest-first trend', async () => {
    await signInAs(ACCOUNTANT);
    const summary = await savingsRepository.summary();

    expect(summary.balanceTotal).toBeGreaterThan(0);
    expect(summary.accountCount).toBeGreaterThan(0);
    // Opted out is a real answer, not a missing one (`savingsPerKg: 0`).
    expect(summary.optedOutCount).toBeGreaterThan(0);
    expect(summary.contributedThisMonth).toBeGreaterThan(0);
    expect(summary.contributingSuppliers).toBeGreaterThan(0);
    expect(summary.averagePerKg).not.toBeNull();

    // Oldest first — charts read left to right, and a cumulative balance only means
    // something in the order it accumulated.
    const keys = summary.trend.map((row) => row.monthKey);
    expect([...keys].sort()).toEqual(keys);
    // The liability only grows while there is no withdrawal path.
    for (let i = 1; i < summary.trend.length; i += 1) {
      expect(summary.trend[i]!.balanceTotal).toBeGreaterThanOrEqual(
        summary.trend[i - 1]!.balanceTotal,
      );
    }
  });

  it('ties a month’s factory total to that month’s contributions', async () => {
    await signInAs(ACCOUNTANT);
    const summary = await savingsRepository.summary();
    const run = await billRepository.run(summary.monthKey);

    // The savings the bills deducted and the savings the ledger credited are the
    // same money, counted once.
    expect(summary.contributedThisMonth).toBeCloseTo(run.savingsTotal, 2);
  });

  it('ties every account balance to its own passbook', async () => {
    await signInAs(ACCOUNTANT);
    const accounts = await savingsRepository.accounts({ optedOut: false, pageSize: 8 });
    expect(accounts.items.length).toBeGreaterThan(0);

    for (const account of accounts.items) {
      const ledger = await savingsRepository.ledger(account.supplierId);
      const rows = ledger.items;
      expect(rows.length).toBeGreaterThan(0);

      // Oldest first, and the running balance is the sum of everything before it.
      const months = rows.map((row) => row.monthKey);
      expect([...months].sort()).toEqual(months);

      let running = 0;
      for (const row of rows) {
        running = round2(running + row.amount);
        expect(row.balance).toBeCloseTo(running, 2);
      }

      // The account row is the ledger's closing balance, not a separate figure.
      expect(account.balance).toBeCloseTo(rows.at(-1)!.balance, 2);

      // …and so is the registry's, which is what AC-01 is about: one value, one
      // answer, wherever the office looks at it.
      const supplier = await supplierRepository.get(account.supplierId);
      expect(supplier.savingsBalance).toBeCloseTo(account.balance, 2);
      expect(account.savingsPerKg).toBe(supplier.savingsPerKg);
    }
  }, 30_000);

  it('creates a contribution from a published bill and nothing else', async () => {
    await signInAs(ACCOUNTANT);
    const accounts = await savingsRepository.accounts({ optedOut: false, pageSize: 5 });
    const account = accounts.items[0]!;
    const ledger = await savingsRepository.ledger(account.supplierId);

    const contributions = ledger.items.filter((row) => row.source === 'billDeduction');
    expect(contributions.length).toBeGreaterThan(0);

    for (const entry of contributions) {
      // Every contribution names the bill it came from…
      expect(entry.billId).not.toBeNull();
      const bill = await billRepository.get(entry.billId!);
      // …and equals that bill's savings line to the cent.
      expect(entry.amount).toBeCloseTo(bill.deductions.savings, 2);
      expect(bill.supplierId).toBe(account.supplierId);
      // A draft bill never credits a passbook: only a published one does.
      expect(bill.publishedAt).not.toBeNull();
    }

    // The only other kind of row in the fixture is the balance carried in from the
    // paper passbook. There is no withdrawal and no interest, by decision (§21.9).
    const sources = new Set(ledger.items.map((row) => row.source));
    expect([...sources].every((source) => source === 'billDeduction' || source === 'openingBalance')).toBe(
      true,
    );
  }, 20_000);

  it('credits the passbook when a month is published, and not before', async () => {
    await signInAs(ACCOUNTANT);
    const months = await monthRepository.list();
    const month = months.items.find((candidate) => candidate.open)!;

    await monthRepository.setRate(month.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    const open = await monthRepository.exceptions(month.monthKey, { resolved: false });
    await Promise.all(
      open.items.map((exception) =>
        monthRepository.resolveException(
          month.monthKey,
          exception.id,
          'Checked against the counter records and accepted for this month.',
        ),
      ),
    );
    const run = await billRepository.generate(month.monthKey);
    expect(run.savingsTotal).toBeGreaterThan(0);

    // Generated, not published: the deduction exists on a draft bill and the
    // passbook has not moved.
    const before = await savingsRepository.summary();
    expect(before.monthKey).not.toBe(month.monthKey);

    signOut();
    await signInWithMfaAs(MANAGER);
    await monthRepository.publish(month.monthKey);

    signOut();
    await signInAs(ACCOUNTANT);
    const after = await savingsRepository.summary();
    expect(after.monthKey).toBe(month.monthKey);
    expect(after.contributedThisMonth).toBeCloseTo(run.savingsTotal, 2);
    // The factory now holds exactly what it held before, plus this month's savings.
    expect(after.balanceTotal).toBeCloseTo(round2(before.balanceTotal + run.savingsTotal), 2);
  }, 40_000);

  it('flags an open savings-rate request without applying it (AC-01)', async () => {
    await signInAs(ACCOUNTANT);
    const accounts = await savingsRepository.accounts({ pageSize: 200 });
    const pending = accounts.items.filter((account) => account.pendingRateChangeId !== null);

    // The fixture carries savings-rate requests in M9's queue, so this proves the
    // link rather than an empty filter.
    expect(pending.length).toBeGreaterThan(0);
    for (const account of pending) {
      const supplier = await supplierRepository.get(account.supplierId);
      // The **active** rate is what is shown. A pending change is a link to the
      // queue, never a value applied early.
      expect(account.savingsPerKg).toBe(supplier.savingsPerKg);
      expect(account.pendingRateChangeId).toMatch(/^chg-/);
    }
  }, 20_000);

  it('separates opted-out accounts from contributing ones', async () => {
    await signInAs(ACCOUNTANT);
    const optedOut = await savingsRepository.accounts({ optedOut: true, pageSize: 200 });
    const contributing = await savingsRepository.accounts({ optedOut: false, pageSize: 200 });

    expect(optedOut.total).toBeGreaterThan(0);
    expect(contributing.total).toBeGreaterThan(0);
    for (const account of optedOut.items) expect(account.savingsPerKg).toBe(0);
    for (const account of contributing.items) expect(account.savingsPerKg).toBeGreaterThan(0);

    const summary = await savingsRepository.summary();
    expect(optedOut.total).toBe(summary.optedOutCount);
    expect(optedOut.total + contributing.total).toBe(summary.accountCount);
  });

  it('404s a passbook for a supplier who does not exist', async () => {
    await signInAs(ACCOUNTANT);
    await expect(savingsRepository.ledger('sup-nope')).rejects.toMatchObject({ code: '404' });
  });

  it('gives the weigher no access to savings at all (§12.1)', async () => {
    // Savings is gated on `billing`, which §12.1 gives the weigher not at all — the
    // module has no capability of its own, and inventing one would be a permission
    // the matrix has never granted anybody.
    await signInAs(WEIGHER);
    const refused = await savingsRepository.accounts().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  });

  it('lets a clerk read the scheme (§12.1)', async () => {
    await signInAs(CLERK);
    await expect(savingsRepository.summary()).resolves.toBeTruthy();
    await expect(savingsRepository.accounts({ pageSize: 1 })).resolves.toBeTruthy();
  });
});

/**
 * AC-07's second half, which status.md records as a gap: *"a flag off removes the
 * surface **and** the endpoint refuses"*.
 *
 * Driven with `fetch` and an explicit `X-Tenant` rather than through a repository,
 * because the console resolves its tenant **once at module load** (`config/tenant.ts`)
 * and switching it mid-session is deliberately impossible — the dev switcher reloads
 * the page. So this reaches the handler the way a replayed request or a hand-typed URL
 * would, which is exactly the attack the API half exists to stop.
 */
describe('AC-07 · a flag off refuses the endpoint, not only the sidebar', () => {
  beforeEach(() => {
    signOut();
  });

  it('refuses payouts for a tenant that does not buy them', async () => {
    await signInAs(ACCOUNTANT);
    const token = useAuthStore.getState().accessToken;

    const asTenant = (tenant: string) =>
      fetch('http://localhost/admin/payout-runs', {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant': tenant },
      });

    // Galaboda buys payouts.
    expect((await asTenant('galaboda')).status).toBe(200);

    // Highland counts cash out at the counter and buys no bank-file module. The
    // console hides the row; this is the half that cannot be bypassed.
    const refused = await asTenant('highland');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'feature-disabled' });
  });
});
