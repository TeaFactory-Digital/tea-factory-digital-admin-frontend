/**
 * M5 against the mock API.
 *
 * A bill is the document a supplier is handed, so these are mostly about the
 * arithmetic being right and staying right:
 *
 *  - **The figures tie.** Gross is kilos × the rate, the nine lines add up to their
 *    own total (BR-107), and the balance follows from both. AC-03 requires the
 *    console, the slip and the app's Home screen to agree field for field, and the
 *    only way that holds is if there is one derivation — `@tfd/domain/bill.ts`.
 *  - **Re-generating is normal.** A bill is a read model, so a corrected rate or a
 *    voided delivery has to be pickable up while the month is open.
 *  - **`null` is not `0`** (BR-102). A month with no auction result cannot produce a
 *    bill at all, rather than producing one full of zeros.
 *  - **A published month is immutable** (BR-108), for its bills as much as its rate.
 *
 * They run through the repository, so the month-key guard and the balance check the
 * screens rely on are in the path too.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DEDUCTION_CATEGORIES, colomboDayOf, round2, sumDeductionLines } from '@tfd/domain';
import { billRepository, billIsBalanced } from '@/services/repositories/billRepository';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const WEIGHER = 'weigher@galabodatea.lk';

const TODAY = colomboDayOf(new Date());

/** The month in progress — the only one the fixture leaves open. */
async function openMonth() {
  const page = await monthRepository.list();
  const open = page.items.find((month) => month.open);
  if (!open) throw new Error('fixture has no open month');
  return open;
}

/** The newest month the fixture has already published, which carries bills. */
async function publishedMonth() {
  const months = await billRepository.months();
  const closed = months.find((month) => !month.open && month.billCount > 0);
  if (!closed) throw new Error('fixture has no published month with bills');
  return closed;
}

describe('M5 bills', () => {
  beforeEach(() => {
    signOut();
  });

  it('carries a run and a bill per supplier for every published month', async () => {
    await signInAs(ACCOUNTANT);
    const month = await publishedMonth();

    const run = await billRepository.run(month.monthKey);
    expect(run.billCount).toBeGreaterThan(0);
    expect(run.payableTotal).toBeGreaterThan(0);
    // A published month cannot be stale: nothing can change under it (BR-108).
    expect(run.stale).toBe(false);

    const page = await billRepository.list({ monthKey: month.monthKey, pageSize: 200 });
    expect(page.total).toBe(run.billCount);
    // Ordered by supplier code, which is how the office reads a run down.
    const codes = page.items.map((bill) => bill.supplierCode);
    expect([...codes].sort((a, b) => a.localeCompare(b))).toEqual(codes);
  });

  it('derives every figure on the slip from the leaf and the rate (AC-03)', async () => {
    await signInAs(ACCOUNTANT);
    const month = await publishedMonth();
    const page = await billRepository.list({ monthKey: month.monthKey, pageSize: 5 });
    const summary = page.items[0]!;
    const bill = await billRepository.get(summary.id);

    expect(bill.auctionResultAvailable).toBe(true);
    expect(bill.totalRatePerKg).toBeCloseTo(round2(bill.ratePerKg! + bill.extraRatePerKg!), 2);
    expect(bill.greenLeafAmount).toBeCloseTo(round2(bill.totalKgs * bill.ratePerKg!), 2);
    expect(bill.extraPayment).toBeCloseTo(round2(bill.totalKgs * bill.extraRatePerKg!), 2);
    expect(bill.grossAmount).toBeCloseTo(
      round2(bill.greenLeafAmount! + bill.extraPayment!),
      2,
    );

    // BR-107: the nine itemized lines equal the stated total.
    expect(billIsBalanced(bill)).toBe(true);
    expect(sumDeductionLines(bill.deductions)).toBeCloseTo(bill.deductions.total, 2);
    // Every line is present, zeros included — the nine are the document's shape.
    for (const category of DEDUCTION_CATEGORIES) {
      expect(typeof bill.deductions[category]).toBe('number');
    }

    expect(bill.balanceAmount).toBeCloseTo(
      round2(bill.grossAmount! - bill.deductions.total),
      2,
    );

    /**
     * The factory pays whole rupees and the cents carry.
     *
     * Checked as an identity rather than a value: `finalBalance` is an integer, and
     * what was earned has to equal what was paid plus what was held back.
     */
    expect(Number.isInteger(bill.finalBalance)).toBe(true);
    expect(round2(bill.finalBalance! + bill.coinsCarriedForward)).toBeCloseTo(
      round2(bill.balanceAmount! + bill.coinsBroughtForward),
      2,
    );

    // The day grid covers the whole month, with `null` where nothing was weighed.
    expect(bill.dailySupply.length).toBeGreaterThanOrEqual(28);
    const daily = round2(
      bill.dailySupply.reduce((sum, day) => sum + (day.kgs ?? 0), 0),
    );
    expect(daily).toBeCloseTo(bill.totalKgs, 2);
  });

  it('deducts savings at the supplier’s own rate, and prints the running balance', async () => {
    await signInAs(ACCOUNTANT);
    const month = await publishedMonth();
    const page = await billRepository.list({ monthKey: month.monthKey, pageSize: 200 });

    // At least one supplier is in the scheme, or the assertion below proves nothing.
    const contributing = page.items.filter((bill) => bill.finalBalance !== null);
    expect(contributing.length).toBeGreaterThan(0);

    for (const summary of contributing.slice(0, 8)) {
      const bill = await billRepository.get(summary.id);
      const supplier = await supplierRepository.get(bill.supplierId);

      expect(bill.deductions.savings).toBeCloseTo(
        round2(bill.totalKgs * supplier.savingsPerKg),
        2,
      );
      // The slip's savings block ties to the deduction it came from.
      expect(bill.savingsSummary.thisMonth).toBeCloseTo(bill.deductions.savings, 2);
      expect(bill.savingsSummary.toDate).toBeCloseTo(
        round2(bill.savingsSummary.previous + bill.savingsSummary.thisMonth),
        2,
      );
    }
  });

  it('pays nothing when the deductions swallow the account, and carries the shortfall', async () => {
    await signInAs(ACCOUNTANT);
    const month = await publishedMonth();
    const page = await billRepository.list({
      monthKey: month.monthKey,
      carriesDebt: true,
      pageSize: 50,
    });

    // The fixture is built to contain some, because this is the state a payout run
    // must not turn into a negative bank line.
    expect(page.total).toBeGreaterThan(0);

    for (const summary of page.items.slice(0, 5)) {
      const bill = await billRepository.get(summary.id);
      expect(bill.finalBalance).toBe(0);
      expect(bill.coinsCarriedForward).toBe(0);
      expect(bill.carryForward.nextMonthDeb).toBeGreaterThan(0);
      // What is carried is exactly what could not be paid.
      expect(bill.carryForward.nextMonthDeb).toBeCloseTo(
        round2(-(bill.balanceAmount! + bill.coinsBroughtForward)),
        2,
      );
    }
  });

  it('lists the bills a payout run will not be able to pay', async () => {
    await signInAs(ACCOUNTANT);
    const month = await publishedMonth();

    const run = await billRepository.run(month.monthKey);
    const page = await billRepository.list({
      monthKey: month.monthKey,
      missingBankDetails: true,
      pageSize: 200,
    });

    // The run's count and the list agree — a count nobody can work through is the
    // thing AC-04 is written against.
    expect(page.total).toBe(run.missingBankDetails);
    for (const bill of page.items) {
      expect(bill.hasBankDetails).toBe(false);
      expect(bill.finalBalance ?? 0).toBeGreaterThan(0);
    }
  });

  it('refuses to generate without a rate, and generates once there is one', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();

    // A month with no auction result produces no bills, rather than bills full of
    // zeros (BR-102).
    await expect(billRepository.run(month.monthKey)).rejects.toMatchObject({
      code: 'bills-missing',
    });
    await expect(billRepository.generate(month.monthKey)).rejects.toMatchObject({
      code: 'rate-missing',
    });

    await monthRepository.setRate(month.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    const run = await billRepository.generate(month.monthKey);

    expect(run.billCount).toBeGreaterThan(0);
    expect(run.generatedByName).toBe('Dilani Fonseka');
    expect(run.stale).toBe(false);
    // Generating occupies §13's `billsGenerated` stage.
    expect((await monthRepository.get(month.monthKey)).stage).toBe('billsGenerated');

    // Totals tie to the month's leaf, not to a stored figure.
    const monthSummary = await monthRepository.get(month.monthKey);
    expect(run.totalKgs).toBeCloseTo(monthSummary.totalKgs, 2);
  }, 20_000);

  it('re-generates on a corrected rate, because a bill is a read model', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();
    await monthRepository.setRate(month.monthKey, { ratePerKg: 100, extraRatePerKg: 0 });
    const first = await billRepository.generate(month.monthKey);

    // The auction result was read off a fax and mistyped. Correcting it is normal.
    await monthRepository.setRate(month.monthKey, { ratePerKg: 200, extraRatePerKg: 0 });
    const second = await billRepository.generate(month.monthKey);

    expect(second.grossTotal).toBeCloseTo(first.grossTotal * 2, 0);
    // One run per month: a second set of figures beside the first is two answers
    // nobody can choose between.
    const page = await billRepository.list({ monthKey: month.monthKey, pageSize: 200 });
    expect(page.total).toBe(second.billCount);
    expect(new Set(page.items.map((bill) => bill.id)).size).toBe(page.total);
  }, 20_000);

  it('goes stale when the leaf moves, and stops being stale when re-run', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();
    await monthRepository.setRate(month.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    await billRepository.generate(month.monthKey);
    expect((await billRepository.run(month.monthKey)).stale).toBe(false);

    signOut();
    await signInAs(WEIGHER);
    const supplier = (await supplierRepository.list({ status: 'active', pageSize: 1 })).items[0]!;
    await deliveryRepository.commit({
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId: 'm5-stale',
      rows: [{ supplierId: supplier.id, kgs: 25 }],
    });

    signOut();
    await signInAs(ACCOUNTANT);
    expect((await billRepository.run(month.monthKey)).stale).toBe(true);
    expect((await billRepository.generate(month.monthKey)).stale).toBe(false);
  }, 20_000);

  it('locks the bills once the month is published (BR-108)', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();
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
    await billRepository.generate(month.monthKey);

    // Before the publish a bill is the office's working figure, not the supplier's.
    const before = await billRepository.list({ monthKey: month.monthKey, pageSize: 1 });
    expect((await billRepository.get(before.items[0]!.id)).publishedAt).toBeNull();

    signOut();
    await signInWithMfaAs(MANAGER);
    await monthRepository.publish(month.monthKey);

    // Publishing is what makes them the documents suppliers hold.
    const after = await billRepository.get(before.items[0]!.id);
    expect(after.publishedAt).not.toBeNull();

    await expect(billRepository.generate(month.monthKey)).rejects.toMatchObject({
      code: 'month-locked',
    });
  }, 30_000);

  it('writes an audit entry for the run (AC-09)', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();
    await monthRepository.setRate(month.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    const run = await billRepository.generate(month.monthKey);

    const trail = await auditRepository.list({ entity: 'billRun', pageSize: 50 });
    const entry = trail.items.find((candidate) => candidate.entityId === run.runId);
    expect(entry).toMatchObject({
      action: 'month.bills.generate',
      entity: 'billRun',
      actorName: 'Dilani Fonseka',
    });
    // The figures the run produced are in the entry, because "what was it generated
    // at" is the question asked once a supplier disputes a slip.
    expect(entry?.after).toMatchObject({ monthKey: month.monthKey, bills: run.billCount });
  }, 20_000);

  it('refuses a month the factory has no records for, and a bill that does not exist', async () => {
    await signInAs(ACCOUNTANT);
    await expect(billRepository.run('1999-01')).rejects.toMatchObject({ code: '404' });
    await expect(billRepository.generate('1999-01')).rejects.toMatchObject({ code: '404' });
    await expect(billRepository.get('bill-nope')).rejects.toMatchObject({ code: '404' });
    // Refused before it leaves the browser: a malformed key would reach the server as
    // a path segment that could match a different month.
    await expect(billRepository.generate('not-a-month')).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('lets a clerk read bills and refuses them the generation (§12.1)', async () => {
    await signInAs('clerk@galabodatea.lk');
    const month = await publishedMonth();

    // `billing: R` — the bills are visible…
    await expect(
      billRepository.list({ monthKey: month.monthKey, pageSize: 1 }),
    ).resolves.toBeTruthy();
    await expect(billRepository.run(month.monthKey)).resolves.toBeTruthy();

    // …and generating is refused by the **server**, not only hidden by the UI.
    signOut();
    await signInAs('clerk@galabodatea.lk');
    const refused = await billRepository
      .generate(month.monthKey)
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  });

  it('gives the weigher no access to bills at all (§12.1)', async () => {
    await signInAs(WEIGHER);
    const refused = await billRepository.list().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  });
});
