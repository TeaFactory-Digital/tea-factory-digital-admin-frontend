/**
 * Factory records kept in the console while the factory-system sync is off
 * (docs/v2/factory-records.md): the switch, one record at a time, and files.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_DEDUCTION_RATES,
  computeBillAmounts,
  factoryBillNumber,
  advanceInterestFor,
  advanceInterestProblem,
  transportChargeFor,
  transportRateFor,
  importRowProblems,
  importTemplateCsv,
  isFactorySyncEnabled,
  billAdjustmentProblem,
} from '@tfd/domain';
import { parseCsv } from '@/lib/csv';
import { ImportDialog } from '@/components/ImportDialog';
import { SuppliersScreen } from '@/modules/suppliers/SuppliersScreen';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { creditRepository } from '@/services/repositories/creditRepository';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { currentMonthKey } from '@/services/mocks/seed';
import { bundledConfig } from '@/config/defaults';
import { renderWithProviders, signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

/**
 * Both copies: the API's, and the bundled one the screens fall back to under jsdom (see
 * `configuration.test.ts` on why the runtime config is always the bundled one here).
 */
async function setSync(enabled: boolean) {
  bundledConfig.factorySync = { enabled };
  await signInAs(ADMIN);
  const { config, usage } = await adminConfigRepository.get();
  await adminConfigRepository.patch({ factorySync: { enabled } }, config, usage);
}

beforeEach(() => signOut());
const bundledPoints = bundledConfig.collectionPoints;
afterEach(() => {
  delete bundledConfig.factorySync;
  bundledConfig.collectionPoints = bundledPoints;
});

describe('the rules the console and the API share', () => {
  it('treats a factory with no setting as synced', () => {
    expect(isFactorySyncEnabled({})).toBe(true);
    expect(isFactorySyncEnabled({ factorySync: { enabled: false } })).toBe(false);
  });

  it('names each problem by spreadsheet row and column', () => {
    const problems = importRowProblems('deliveries', [
      { date: '2026-10-08', supplierCode: '5147', kg: '24.5' },
      { date: '08/10/2026', supplierCode: '', kg: 'twenty' },
    ]);
    expect(problems).toEqual([
      { row: 3, column: 'date', code: 'not-a-date' },
      { row: 3, column: 'supplierCode', code: 'required' },
      { row: 3, column: 'kg', code: 'not-a-number' },
    ]);
    expect(importRowProblems('walkInCredit', [{ supplierCode: '1', facility: 'gift', amount: '5', note: 'x' }]))
      .toEqual([{ row: 2, column: 'facility', code: 'not-allowed' }]);
  });

  it('writes a template whose example row survives a comma', () => {
    const [header, example] = parseCsv(importTemplateCsv('suppliers'));
    expect(header).toContain('supplierCode');
    expect(example![header!.indexOf('homeAddress')]).toBe('No 12, Deniyaya Road, Akuressa');
  });

  it('reads CSV saved by Excel: a byte-order mark, semicolons and quoted cells', () => {
    expect(parseCsv('﻿a;b\r\n"1;2";"say ""hi"""\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['1;2', 'say "hi"'],
    ]);
  });

  it('charges transport at the supplier’s own rate, else the point’s, else the factory’s', () => {
    const rates = { ...DEFAULT_DEDUCTION_RATES, transportPerKg: 2.5, transportByPoint: { far: 4 } };
    expect(transportRateFor(rates, 'near')).toBe(2.5);
    expect(transportRateFor(rates, 'far')).toBe(4);
    expect(transportRateFor(rates, 'far', 3)).toBe(3);
    // 0 is a real rate: a supplier who brings their own leaf.
    expect(transportRateFor(rates, 'far', 0)).toBe(0);
    // Each weighing at its own point's rate.
    expect(transportChargeFor(rates, [{ pointId: 'near', kgs: 10 }, { pointId: 'far', kgs: 10 }])).toBe(65);
    expect(transportChargeFor(rates, [{ pointId: 'near', kgs: 10 }, { pointId: 'far', kgs: 10 }], 1)).toBe(20);
  });

  it('works out a month’s advance interest, and refuses an unlikely rate', () => {
    expect(advanceInterestFor(10000, { monthlyRatePercent: 1.5 })).toBe(150);
    expect(advanceInterestFor(10000, undefined)).toBe(0);
    expect(advanceInterestFor(0, { monthlyRatePercent: 2 })).toBe(0);
    expect(advanceInterestProblem({ monthlyRatePercent: 2 })).toBeNull();
    expect(advanceInterestProblem({ monthlyRatePercent: 25 })).toBe('out-of-range');
    expect(advanceInterestProblem({ monthlyRatePercent: Number.NaN })).toBe('out-of-range');
  });

  it('reproduces the factory’s printed slip, paid in tens (galaboda, July 2026, supplier 5708)', () => {
    const amounts = computeBillAmounts({
      totalKgs: 509.5,
      ratePerKg: 222,
      extraRatePerKg: 3,
      coinsBroughtForward: 7.41,
      savingsWithdrawal: 0,
      paymentUnit: 10,
      deductions: {
        transportCharges: 0,
        tea: 1298,
        savings: 5095,
        loansAdvance: 0,
        advance: 40000,
        manure: 0,
        otherCards: 0,
        stamps: 25,
        previousDebts: 0,
      },
    });
    expect(amounts).toMatchObject({
      greenLeafAmount: 113109,
      extraPayment: 1528.5,
      grossAmount: 114644.91,
      balanceAmount: 68226.91,
      finalBalance: 68220,
      coinsCarriedForward: 6.91,
      nextMonthDeb: 0,
    });
    expect(amounts.deductions.total).toBe(46418);
    expect(factoryBillNumber(2026, 210869)).toBe('2026210869');
  });

  it('needs a reason for any other charge', () => {
    expect(billAdjustmentProblem({ otherCards: 350, otherCardsNote: '' })).toBe('note-required');
    expect(billAdjustmentProblem({ otherCards: -1, otherCardsNote: 'x' })).toBe('negative');
    expect(billAdjustmentProblem({ otherCards: 0, otherCardsNote: '' })).toBeNull();
  });
});

describe('with the factory-system sync on', () => {
  it('offers no way to add a supplier, and the API refuses one', async () => {
    await signInAs(CLERK);
    renderWithProviders(<SuppliersScreen />, { route: '/suppliers' });
    await screen.findByRole('heading', { name: 'Suppliers' });
    expect(screen.queryByRole('button', { name: 'Add supplier' })).not.toBeInTheDocument();

    await expect(
      factoryRecordRepository.createSupplier({
        supplierCode: '9001',
        name: 'Test Supplier',
        nic: '883210456V',
        collectionPoint: 'DENIYAYA',
        paymentMethod: 'cash',
        savingsPerKg: 0,
      }),
    ).rejects.toMatchObject({ code: 'factory-sync-on' });
  });
});

describe('with the factory-system sync off', () => {
  it('adds a supplier from the form', async () => {
    await setSync(false);
    bundledConfig.collectionPoints = [{ id: 'cp-deniyaya', name: 'DENIYAYA' }];
    const user = userEvent.setup();
    await signInAs(CLERK);
    renderWithProviders(<SuppliersScreen />, { route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Add supplier' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Supplier code/), '9101');
    await user.type(within(dialog).getByLabelText(/Full name/), 'Sunil Gamage');
    await user.type(within(dialog).getByLabelText(/NIC number/), '883210456V');
    // Paid in cash, so no bank details are asked for.
    await user.click(within(dialog).getByLabelText(/How they are paid/));
    await user.click(await screen.findByRole('option', { name: 'Cash' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add supplier' }));

    await waitFor(async () => {
      const found = await supplierRepository.list({ q: '9101' });
      expect(found.items.map((one) => one.name)).toContain('Sunil Gamage');
    });
    // A whole form typed key by key; under the full suite's load it can pass 5 s.
  }, 15_000);

  it('imports a file all or nothing, showing the server’s problems by row', async () => {
    await setSync(false);
    const user = userEvent.setup();
    await signInAs(CLERK);
    renderWithProviders(<ImportDialog kind="deliveries" open onClose={() => {}} />);

    const today = new Date().toISOString().slice(0, 10);
    const known = (await supplierRepository.list({ status: 'active', pageSize: 1 })).items[0]!;
    const code = known.supplierCode.split(' ')[0]!;

    const bad = new File([`date,supplierCode,kg\n${today},${code},12.5\n${today},999999,3\n`], 'leaf.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText(/Choose an Excel or CSV file/), bad);
    await user.click(await screen.findByRole('button', { name: 'Import 2 rows' }));
    expect(await screen.findByText(/Row 3, supplierCode: no supplier with this code/)).toBeInTheDocument();
    const before = await deliveryRepository.list({ date: today, pageSize: 200 });

    await user.click(screen.getByRole('button', { name: 'Choose another file' }));
    const good = new File([`date,supplierCode,kg\n${today},${code},12.5\n`], 'leaf.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/Choose an Excel or CSV file/), good);
    await user.click(await screen.findByRole('button', { name: 'Import 1 rows' }));
    expect(await screen.findAllByText('1 rows imported')).not.toHaveLength(0);

    // The refused file saved nothing; the good one saved its one row.
    const after = await deliveryRepository.list({ date: today, pageSize: 200 });
    expect(after.total).toBe(before.total + 1);
  });

  it('records a walk-in request as pending from the office, for someone else to approve', async () => {
    await setSync(false);
    await signInAs(CLERK);
    const supplier = (await supplierRepository.list({ status: 'active', pageSize: 1 })).items[0]!;
    const created = await factoryRecordRepository.createWalkInCredit({
      supplierId: supplier.id,
      facility: 'advance',
      amount: 5000,
      note: 'Asked at the counter for school fees.',
    });
    const saved = await creditRepository.get(created.id);
    expect(saved).toMatchObject({ status: 'pending', channel: 'office', amount: 5000 });
  });

  it('keeps opening balances until a bill exists, then locks them', async () => {
    await setSync(false);
    await signInAs(CLERK);
    const added = await factoryRecordRepository.createSupplier({
      supplierCode: '9102',
      name: 'Kumari Silva',
      nic: '873210456V',
      collectionPoint: 'DENIYAYA',
      paymentMethod: 'cash',
      savingsPerKg: 0,
    });
    expect(await factoryRecordRepository.openingBalances(added.id)).toBeNull();

    const saved = await factoryRecordRepository.saveOpeningBalances(added.id, {
      asOfMonth: currentMonthKey,
      advance: 0,
      loan: 45000,
      manure: 3200,
      teaPackets: 0,
      savings: 12850,
      previousDebt: 0,
      note: 'From the September ledger.',
    });
    expect(saved).toMatchObject({ loan: 45000, savings: 12850, editable: true });

    // A supplier who already has bills cannot be given opening balances.
    const billed = (await billRepository.list({ pageSize: 1 })).items[0]!;
    await expect(
      factoryRecordRepository.saveOpeningBalances(billed.supplierId, { ...saved, note: 'Trying again later.' }),
    ).rejects.toMatchObject({ code: 'opening-balances-locked' });
  });

  it('bills a supplier’s own transport rate and the configured advance interest', async () => {
    await setSync(false);
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch({ advanceInterest: { monthlyRatePercent: 2 } }, config, usage);

    await signInAs(MANAGER);
    await monthRepository.setRate(currentMonthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
    await billRepository.generate(currentMonthKey);
    const row = (await billRepository.list({ monthKey: currentMonthKey, pageSize: 1 })).items[0]!;

    await signInAs(CLERK);
    await expect(
      factoryRecordRepository.saveTransportRate(row.supplierId, { transportPerKg: 7, note: 'x' }),
    ).rejects.toMatchObject({ code: 'note-required' });
    await factoryRecordRepository.saveTransportRate(row.supplierId, {
      transportPerKg: 7,
      note: 'Estate beyond the river',
    });
    expect((await supplierRepository.get(row.supplierId)).transportPerKg).toBe(7);

    await signInAs(MANAGER);
    await billRepository.generate(currentMonthKey);
    const bill = await billRepository.get(row.id);
    expect(bill.deductions.transportCharges).toBeCloseTo(bill.totalKgs * 7, 2);

    const withAdvance = (await billRepository.list({ monthKey: currentMonthKey, pageSize: 100 })).items;
    const bills = await Promise.all(withAdvance.map((one) => billRepository.get(one.id)));
    const owing = bills.find((one) => one.carryForward.loanBalance > 0);
    expect(owing).toBeDefined();
    expect(owing!.carryForward.loanInterest).toBeCloseTo(owing!.carryForward.loanBalance * 0.02, 2);
  });

  it('numbers new bills from the factory’s serial and pays in its unit', async () => {
    await setSync(false);
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch({ billSettings: { paymentUnit: 10, nextBillSerial: 210870 } }, config, usage);

    await signInAs(MANAGER);
    await monthRepository.setRate(currentMonthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
    await billRepository.generate(currentMonthKey);
    const rows = (await billRepository.list({ monthKey: currentMonthKey, pageSize: 200 })).items;
    const year = currentMonthKey.slice(0, 4);
    expect(rows.map((one) => one.billNo)).toContain(`${year}210870`);
    const bill = await billRepository.get(rows[0]!.id);
    expect((bill.finalBalance ?? 0) % 10).toBe(0);

    // A re-generated month keeps each supplier's number.
    await billRepository.generate(currentMonthKey);
    const again = await billRepository.get(rows[0]!.id);
    expect(again.billNo).toBe(bill.billNo);
  });

  it('recalculates a bill when the office types its other charges', async () => {
    await setSync(false);
    await signInAs(MANAGER);
    await monthRepository.setRate(currentMonthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
    await billRepository.generate(currentMonthKey);
    const row = (await billRepository.list({ monthKey: currentMonthKey, pageSize: 1 })).items[0]!;
    const before = await billRepository.get(row.id);

    await factoryRecordRepository.adjustBill(row.id, { otherCards: 350, otherCardsNote: 'Society membership' });
    const after = await billRepository.get(row.id);

    expect(after.deductions.otherCards).toBe(350);
    expect(after.otherCardsNote).toBe('Society membership');
    expect(after.deductions.total).toBeCloseTo(before.deductions.total - before.deductions.otherCards + 350, 2);

    // Re-generating after a corrected weighing keeps the line the office typed.
    await billRepository.generate(currentMonthKey);
    const regenerated = await billRepository.get(row.id);
    expect(regenerated.deductions.otherCards).toBe(350);
    expect(regenerated.otherCardsNote).toBe('Society membership');
  });
});
