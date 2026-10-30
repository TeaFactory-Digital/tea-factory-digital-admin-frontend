/**
 * Corrections after a published bill (C5): a balance corrected at once, a payment on the
 * next bill as a "Correction" line, the manager only, and nothing below zero.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { computeBillAmounts, correctionProblems, correctionTotal } from '@tfd/domain';
import { CorrectionsCard } from '@/modules/suppliers/CorrectionsCard';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { bundledConfig } from '@/config/defaults';
import type * as ServerReady from '@/lib/serverReady';
import { renderWithProviders, signInAs, signOut } from './render';

vi.mock('@/lib/serverReady', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerReady>()),
  CORRECTIONS_ON_SERVER: true,
}));

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const FACTORY_SYSTEM = 'factory-system@galabodatea.lk';

async function setSyncOff() {
  bundledConfig.factorySync = { enabled: false };
  await signInAs(ADMIN);
  const { config, usage } = await adminConfigRepository.get();
  await adminConfigRepository.patch({ factorySync: { enabled: false } }, config, usage);
}

/** A supplier with a published bill, and the month of it. */
async function publishedSupplier() {
  await signInAs(MANAGER);
  const published = (await monthRepository.list()).items.find((one) => !one.open)!;
  const bill = (await billRepository.list({ monthKey: published.monthKey, pageSize: 1 })).items[0]!;
  return { supplierId: bill.supplierId, monthKey: published.monthKey };
}

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
});

describe('the rules', () => {
  const facts = { publishedMonthKeys: ['2026-07'], balances: { loan: 5000, manure: 0, savings: 1000 }, billSource: 'calculated' as const };
  const ok = { target: 'payment' as const, amount: 900, correctsMonthKey: '2026-07', reason: '3.6 kg missed on 14 July' };

  it('accepts a payment correction for a published month', () => {
    expect(correctionProblems(ok, facts)).toEqual([]);
  });

  it('names everything wrong at once', () => {
    expect(correctionProblems({ ...ok, amount: 0, reason: 'short', correctsMonthKey: '2026-08' }, facts)).toEqual([
      'amount-zero',
      'reason-short',
      'month-not-published',
    ]);
  });

  it('keeps a balance at 0 or above', () => {
    expect(correctionProblems({ ...ok, target: 'loan', amount: -5000 }, facts)).toEqual([]);
    expect(correctionProblems({ ...ok, target: 'loan', amount: -5000.01 }, facts)).toEqual(['below-zero']);
    expect(correctionProblems({ ...ok, target: 'savings', amount: -1200 }, facts)).toEqual(['below-zero']);
  });

  it('leaves a payment to the factory system where the bills are imported', () => {
    expect(correctionProblems(ok, { ...facts, billSource: 'imported' })).toEqual(['payment-bills-imported']);
  });

  it('adds a correction after the balance, so the nine lines still add up', () => {
    const facts_ = {
      totalKgs: 100,
      ratePerKg: 100,
      extraRatePerKg: 0,
      coinsBroughtForward: 0,
      savingsWithdrawal: 0,
      deductions: { transportCharges: 500, tea: 0, savings: 0, loansAdvance: 0, advance: 0, manure: 0, otherCards: 0, stamps: 0, previousDebts: 0 },
    };
    const plain = computeBillAmounts(facts_);
    const paid = computeBillAmounts({ ...facts_, correction: correctionTotal([{ correctsMonthKey: '2026-07', amount: 900, reason: 'x' }]) });
    expect(paid.balanceAmount).toBe(plain.balanceAmount);
    expect(paid.deductions.total).toBe(500);
    expect(paid.finalBalance).toBe(10400);
    // Taken back beyond what the month earned: nothing paid, the rest carried as debt.
    const taken = computeBillAmounts({ ...facts_, correction: -10000 });
    expect(taken).toMatchObject({ finalBalance: 0, nextMonthDeb: 500 });
  });
});

describe('posting one', () => {
  it('moves a loan balance at once, for the manager only', async () => {
    await setSyncOff();
    const { supplierId, monthKey } = await publishedSupplier();
    const body = { target: 'loan' as const, amount: 500, correctsMonthKey: monthKey, reason: 'Opening loan typed short by 500' };

    await signInAs(CLERK);
    await expect(factoryRecordRepository.createCorrection(supplierId, body)).rejects.toMatchObject({ status: 403 });

    await signInAs(MANAGER);
    const created = await factoryRecordRepository.createCorrection(supplierId, body);
    expect(created).toMatchObject({ status: 'applied', amount: 500, appliedBillId: null });
    // The 500 is in the balance now: taking it back is allowed, far more is not.
    await factoryRecordRepository.createCorrection(supplierId, { ...body, amount: -500, reason: 'The 500 above was a mistake' });
    await expect(
      factoryRecordRepository.createCorrection(supplierId, { ...body, amount: -1_000_000_000, reason: 'More than the whole loan' }),
    ).rejects.toMatchObject({ code: 'correction-invalid', details: { problems: ['below-zero'] } });
    expect((await factoryRecordRepository.corrections(supplierId)).items.map((one) => one.amount)).toEqual([-500, 500]);
  }, 20_000);

  it('puts a payment correction on the next bill, and marks it applied when that bill is published', async () => {
    await setSyncOff();
    const { supplierId, monthKey } = await publishedSupplier();
    await signInAs(MANAGER);
    await factoryRecordRepository.createCorrection(supplierId, {
      target: 'payment',
      amount: 900,
      correctsMonthKey: monthKey,
      reason: '3.6 kg missed on 14 July',
    });
    expect((await factoryRecordRepository.corrections(supplierId)).items[0]).toMatchObject({ status: 'pending' });

    // The open month: rate, exceptions, bills.
    await signInAs(FACTORY_SYSTEM);
    const month = (await monthRepository.list()).items.find((one) => one.open)!;
    await monthRepository.setRate(month.monthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
    const open = await monthRepository.exceptions(month.monthKey, { resolved: false });
    await Promise.all(
      open.items.map((exception) =>
        monthRepository.resolveException(month.monthKey, exception.id, 'Checked against the counter records and accepted.'),
      ),
    );
    await billRepository.generate(month.monthKey);
    const bills = (await billRepository.list({ monthKey: month.monthKey, pageSize: 500 })).items;
    const ours = bills.find((one) => one.supplierId === supplierId)!;
    const bill = await billRepository.get(ours.id);
    expect(bill.corrections).toEqual([{ correctsMonthKey: monthKey, amount: 900, reason: '3.6 kg missed on 14 July' }]);
    // BR-107 untouched: the correction is outside the nine lines.
    expect(bill.deductions.total).toBe(
      Object.entries(bill.deductions)
        .filter(([key]) => key !== 'total')
        .reduce((sum, [, value]) => sum + value, 0),
    );

    // Every printed figure equal to ours, then the publish.
    await signInAs(CLERK);
    await factoryRecordRepository.importRows(
      'printedBalances',
      'slips.csv',
      bills.map((one) => ({ month: month.monthKey, supplierCode: one.supplierCode, finalBalance: String(one.finalBalance ?? 0) })),
    );
    await signInAs(MANAGER);
    await monthRepository.publish(month.monthKey);
    expect((await factoryRecordRepository.corrections(supplierId)).items[0]).toMatchObject({
      status: 'applied',
      appliedBillId: ours.id,
      appliedMonthKey: month.monthKey,
    });
  }, 30_000);
});

describe('the card', () => {
  it('offers the form to the manager, not to the clerk', async () => {
    await setSyncOff();
    const { supplierId } = await publishedSupplier();
    const balances = { loan: 0, manure: 0, savings: 0 };

    await signInAs(MANAGER);
    const manager = renderWithProviders(<CorrectionsCard supplierId={supplierId} balances={balances} />);
    expect(await screen.findByRole('button', { name: 'Post a correction' })).toBeInTheDocument();
    manager.unmount();

    await signInAs(CLERK);
    renderWithProviders(<CorrectionsCard supplierId={supplierId} balances={balances} />);
    expect(await screen.findByText('No corrections.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post a correction' })).toBeNull();
  }, 20_000);
});
