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
  ACTIVITY_FLAG,
  IMPORT_COLUMNS,
  billSettingsProblem,
  loanRecovery,
  supplierCodeSchema,
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
    expect(importRowProblems('walkInCredit', [{ supplierCode: '1', facility: 'gift', amount: '5', note: 'Asked at the counter' }]))
      .toEqual([{ row: 2, column: 'facility', code: 'not-allowed' }]);
  });

  it('refuses what only looks like a number or a date, rather than rounding it', () => {
    expect(
      importRowProblems('deliveries', [
        { date: '2026-02-31', supplierCode: '5147', kg: '24.555' },
        { date: '2026-10-08', supplierCode: '5147', kg: '0x1A' },
        { date: '2026-10-08', supplierCode: '5147', kg: '1e3' },
        { date: '2024-02-29', supplierCode: '5147', kg: '24.5' },
      ]),
    ).toEqual([
      { row: 2, column: 'date', code: 'not-a-date' },
      { row: 2, column: 'kg', code: 'too-many-decimals' },
      { row: 3, column: 'kg', code: 'not-a-number' },
      { row: 4, column: 'kg', code: 'not-a-number' },
    ]);
    // Repayment months are whole accounts.
    expect(
      importRowProblems('walkInCredit', [
        { supplierCode: '5147', facility: 'loan', amount: '50000', repaymentMonths: '6.5', note: 'At the counter' },
      ]),
    ).toEqual([{ row: 2, column: 'repaymentMonths', code: 'too-many-decimals' }]);
  });

  it('takes finished bills as printed, refusing a row that does not add up', () => {
    // The template's example row is the real galaboda slip: it adds up exactly.
    const slip = Object.fromEntries(IMPORT_COLUMNS.bills.map((column) => [column.key, column.example]));
    expect(importRowProblems('bills', [slip])).toEqual([]);
    // A month the supplier owes: a negative balance, nothing paid, the shortfall carried.
    const owed = {
      ...slip,
      advance: '110000',
      totalDeductions: '116418',
      balanceAmount: '-1773.09',
      finalBalance: '0',
      coinsCarriedForward: '0',
      nextMonthDebt: '1773.09',
    };
    expect(importRowProblems('bills', [owed])).toEqual([]);
    // A savings withdrawal paid on the bill is part of what was paid.
    expect(
      importRowProblems('bills', [{ ...slip, savingsWithdrawal: '1000', finalBalance: '69220' }]),
    ).toEqual([]);
    // A gross typed one column over: caught, and nothing else is guessed at.
    expect(importRowProblems('bills', [{ ...slip, grossAmount: '113109' }])).toEqual([
      { row: 2, column: 'grossAmount', code: 'does-not-add-up' },
      { row: 2, column: 'balanceAmount', code: 'does-not-add-up' },
    ]);
  });

  it('follows what the backend asked for: note length, slip codes, long serials, bell flags', () => {
    expect(
      importRowProblems('walkInCredit', [{ supplierCode: '5147', facility: 'advance', amount: '5000', note: 'counter' }]),
    ).toEqual([{ row: 2, column: 'note', code: 'too-short' }]);
    expect(supplierCodeSchema.safeParse('5708 (URUMUTHTH...)').success).toBe(true);
    expect(supplierCodeSchema.safeParse('A12').success).toBe(true);
    expect(billSettingsProblem({ paymentUnit: 10, nextBillSerial: 1_000_000 })).toBeNull();
    expect(ACTIVITY_FLAG['creditRequest.created']({ facility: 'loan' })).toBe('enableLoans');
    expect(ACTIVITY_FLAG['changeRequest.created']({})).toBeNull();
  });

  it('takes a loan’s interest on top of the instalment or inside it, as configured', () => {
    // The factory's own example: Rs. 50,000 over 10 months, Rs. 500 interest at 1%.
    expect(loanRecovery(50000, 5000, { monthlyRatePercent: 1, recovery: 'onTop' })).toEqual({
      interest: 500,
      deducted: 5500,
      principalRepaid: 5000,
    });
    expect(loanRecovery(50000, 5000, { monthlyRatePercent: 1, recovery: 'withinInstalment' })).toEqual({
      interest: 500,
      deducted: 5000,
      principalRepaid: 4500,
    });
    // No rate: the instalment, nothing more.
    expect(loanRecovery(50000, 5000, undefined)).toEqual({ interest: 0, deducted: 5000, principalRepaid: 5000 });
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

  it('refuses a walk-in loan or advance while the supplier still owes a loan, but not manure', async () => {
    await setSync(false);
    await signInAs(CLERK);
    // A supplier who came over with a loan still running.
    const owing = await factoryRecordRepository.createSupplier({
      supplierCode: '9177',
      name: 'Saman Jayasena',
      nic: '853210456V',
      collectionPoint: 'DENIYAYA',
      paymentMethod: 'cash',
      savingsPerKg: 0,
    });
    await factoryRecordRepository.saveOpeningBalances(owing.id, {
      asOfMonth: currentMonthKey,
      advance: 0,
      loan: 30000,
      manure: 0,
      teaPackets: 0,
      savings: 0,
      previousDebt: 0,
      note: 'From the September ledger.',
    });
    for (const facility of ['advance', 'loan'] as const) {
      await expect(
        factoryRecordRepository.createWalkInCredit({
          supplierId: owing.id,
          facility,
          amount: 5000,
          repaymentMonths: facility === 'loan' ? 6 : undefined,
          note: 'Asked at the counter for school fees.',
        }),
      ).rejects.toMatchObject({ code: 'loan-outstanding' });
    }
  });

  it('will not switch the sync or the bill source while a month is half done', async () => {
    await setSync(false);
    await signInAs(MANAGER);
    await monthRepository.setRate(currentMonthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
    await billRepository.generate(currentMonthKey);
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await expect(
      adminConfigRepository.patch({ factorySync: { enabled: true } }, config, usage),
    ).rejects.toMatchObject({ code: 'sync-switch-blocked' });
    await expect(
      adminConfigRepository.patch({ billSettings: { paymentUnit: 1, source: 'imported' } }, config, usage),
    ).rejects.toMatchObject({ code: 'bill-source-blocked' });
  });

  it('keeps opening balances until a bill is published, then locks them', async () => {
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
    // An advance is taken back in full on its month's bill, so on an account that covered
    // its deductions nothing of it is left to bear interest. "Loan Balance" is the loan's,
    // and with no loan rate set, a covered account carries no interest at all.
    const covered = bills.filter((one) => one.carryForward.nextMonthDeb === 0);
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((one) => one.carryForward.loanInterest === 0)).toBe(true);
    expect(bills.some((one) => one.carryForward.loanBalance > 0)).toBe(true);
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

  it('charges loan interest only when the factory sets a rate', async () => {
    await setSync(false);
    await signInAs(ADMIN);
    let { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch({ advanceInterest: { monthlyRatePercent: 0 } }, config, usage);

    await signInAs(MANAGER);
    await monthRepository.setRate(currentMonthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
    await billRepository.generate(currentMonthKey);
    const rows = (await billRepository.list({ monthKey: currentMonthKey, pageSize: 200 })).items;
    const bills = await Promise.all(rows.map((one) => billRepository.get(one.id)));
    // The default: no rate, no interest.
    expect(bills.every((one) => one.carryForward.loanInterest === 0)).toBe(true);

    await signInAs(ADMIN);
    ({ config, usage } = await adminConfigRepository.get());
    await adminConfigRepository.patch({ loanInterest: { monthlyRatePercent: 1 } }, config, usage);

    await signInAs(MANAGER);
    await billRepository.generate(currentMonthKey);
    const after = await Promise.all(rows.map((one) => billRepository.get(one.id)));
    // Suppliers with a loan still owed now carry 1% of it; the rest still carry none.
    expect(after.some((one) => one.carryForward.loanInterest > 0)).toBe(true);
    expect(after.filter((one) => one.carryForward.loanInterest > 0).length).toBeLessThan(after.length);
  });

  it('imports a month of finished bills from the factory, keeping every figure as printed', async () => {
    await setSync(false);
    // A factory that calculates its bills refuses an import, and the other way round.
    await signInAs(MANAGER);
    const slipRow = Object.fromEntries(IMPORT_COLUMNS.bills.map((column) => [column.key, column.example]));
    await expect(
      factoryRecordRepository.importRows('bills', 'early.xlsx', [{ ...slipRow, month: currentMonthKey }]),
    ).rejects.toMatchObject({ code: 'wrong-bill-source' });
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch(
      { billSettings: { paymentUnit: 10, source: 'imported' } },
      config,
      usage,
    );
    await signInAs(MANAGER);
    await expect(billRepository.generate(currentMonthKey)).rejects.toMatchObject({ code: 'wrong-bill-source' });
    const someone = (await billRepository.list({ pageSize: 1 })).items[0]!;
    const slip = Object.fromEntries(IMPORT_COLUMNS.bills.map((column) => [column.key, column.example]));
    const result = await factoryRecordRepository.importRows('bills', 'july-bills.xlsx', [
      { ...slip, month: currentMonthKey, supplierCode: someone.supplierCode },
    ]);
    expect(result).toMatchObject({ saved: 1, problems: [] });

    const bill = await billRepository.get(`bill-${currentMonthKey}-${someone.supplierId}`);
    expect(bill).toMatchObject({
      source: 'imported',
      billNo: '2026210869',
      grossAmount: 114644.91,
      finalBalance: 68220,
      coinsCarriedForward: 6.91,
      savingsSummary: { thisMonth: 5095, previous: 21970, toDate: 27065 },
    });
    expect(bill.deductions.total).toBe(46418);
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
