/**
 * A month of bills imported from the factory's own system, end to end against the mock as
 * the API builds it (#45 step 1): the import creates the month, the importer may not publish
 * it, a late division file waits for a manager (R15), and the shared row checks are exact.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS, importRowProblems, missingImportColumns } from '@tfd/domain';
import { bundledConfig } from '@/config/defaults';
import { mockPublishDuringNextImport, setMockNow, setMockPublishInProgress } from '@/services/mocks/handlers';
import { creditRepository } from '@/services/repositories/creditRepository';
import { errorMessageKey } from '@/lib/errorMessage';
import { currentMonthKey } from '@/services/mocks/seed';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

const slip = () => Object.fromEntries(IMPORT_COLUMNS.bills.map((column) => [column.key, column.example]));

/** A factory that keeps its records here and imports its bills, on the 10th of next month. */
async function importingFactory() {
  bundledConfig.factorySync = { enabled: false };
  await signInAs(ADMIN);
  const { config, usage } = await adminConfigRepository.get();
  await adminConfigRepository.patch(
    { factorySync: { enabled: false }, billSettings: { paymentUnit: 10, source: 'imported' } },
    config,
    usage,
  );
  const [year, month] = currentMonthKey.split('-').map(Number) as [number, number];
  setMockNow(new Date(Date.UTC(year, month, 10, 6)));
}

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
  setMockNow(null);
});

describe('the shared row checks the API also runs', () => {
  it('wants the balance columns in the header, even though a blank cell is 0', () => {
    const headers = IMPORT_COLUMNS.bills.map((column) => column.key);
    expect(missingImportColumns('bills', headers)).toEqual([]);
    expect(
      missingImportColumns('bills', headers.filter((key) => key !== 'loanBalance' && key !== 'savingsToDate')),
    ).toEqual(['loanBalance', 'savingsToDate']);
  });

  it('holds every sum to the cent, and nothing owed or held back on the wrong side', () => {
    expect(importRowProblems('bills', [slip()])).toEqual([]);
    // A cent out on the gross.
    expect(importRowProblems('bills', [{ ...slip(), grossAmount: '114644.92' }])).toContainEqual({
      row: 2,
      column: 'grossAmount',
      code: 'does-not-add-up',
    });
    // Paid in full, so nothing can be carried as debt.
    expect(importRowProblems('bills', [{ ...slip(), nextMonthDebt: '5' }])).toEqual([
      { row: 2, column: 'nextMonthDebt', code: 'does-not-add-up' },
    ]);
    // Owed, so nothing is paid and no coins are held back.
    const owed = {
      ...slip(),
      advance: '110000',
      totalDeductions: '116418',
      balanceAmount: '-1773.09',
      finalBalance: '0',
      nextMonthDebt: '1773.09',
    };
    expect(importRowProblems('bills', [{ ...owed, coinsCarriedForward: '0' }])).toEqual([]);
    expect(importRowProblems('bills', [{ ...owed, coinsCarriedForward: '6.91' }])).toContainEqual({
      row: 2,
      column: 'coinsCarriedForward',
      code: 'does-not-add-up',
    });
    // A loan runs 1 to 360 instalments.
    expect(importRowProblems('bills', [{ ...slip(), loanInstalmentNo: '361' }])).toEqual([
      { row: 2, column: 'loanInstalmentNo', code: 'too-large' },
    ]);
  });
});

describe('a month of imported bills', () => {
  const row = (code: string, billNo: string) => ({ ...slip(), month: currentMonthKey, supplierCode: code, billNo });

  it('may not be published by whoever imported its bills', async () => {
    await importingFactory();
    const [someone] = (await supplierRepository.list({ status: 'active', pageSize: 1 })).items;
    await signInAs(MANAGER);
    expect(
      await factoryRecordRepository.importRows('bills', 'division-a.xlsx', [row(someone!.supplierCode, '2026300001')]),
    ).toMatchObject({ saved: 1, problems: [] });
    await expect(monthRepository.publish(currentMonthKey)).rejects.toMatchObject({ code: 'four-eyes-violation' });
  });

  it('publishes without any leaf entered, and a late file waits for a manager', async () => {
    await importingFactory();
    const [first, second, third] = (await supplierRepository.list({ status: 'active', pageSize: 3 })).items;

    // The clerk imports two divisions; the import creates the month.
    await signInAs(CLERK);
    await factoryRecordRepository.importRows('bills', 'division-a.xlsx', [row(first!.supplierCode, '2026300001')]);
    // A bill number the factory gave someone else is refused.
    expect(
      await factoryRecordRepository.importRows('bills', 'division-b.xlsx', [row(second!.supplierCode, '2026300001')]),
    ).toMatchObject({ saved: 0, problems: [{ row: 2, column: 'billNo', code: 'bill-no-taken' }] });
    await factoryRecordRepository.importRows('bills', 'division-b.xlsx', [row(second!.supplierCode, '2026300002')]);

    // The manager, who imported nothing, publishes: no leaf step, no exceptions to resolve.
    await signInAs(MANAGER);
    await monthRepository.publish(currentMonthKey);
    expect(await billRepository.get(`bill-${currentMonthKey}-${first!.id}`)).toMatchObject({
      publishedAt: expect.any(String),
    });

    // A late division file: its supplier had no bill, so it is saved, and waits.
    await signInAs(CLERK);
    expect(
      await factoryRecordRepository.importRows('bills', 'division-c.xlsx', [row(third!.supplierCode, '2026300003')]),
    ).toMatchObject({ saved: 1, problems: [] });
    // A supplier who already has a bill in the published month is refused.
    expect(
      await factoryRecordRepository.importRows('bills', 'division-a.xlsx', [row(first!.supplierCode, '2026300001')]),
    ).toMatchObject({ saved: 0, problems: [{ row: 2, column: 'month', code: 'month-locked' }] });

    // While it waits, a late bill found wrong is replaced by sending it again (R18).
    expect(
      await factoryRecordRepository.importRows('bills', 'division-c.xlsx', [
        { ...row(third!.supplierCode, '2026300003'), otherCards: '0', note: 'corrected' },
      ]),
    ).toMatchObject({ saved: 1, problems: [] });

    // Waiting late bills hold back the switches, and the next month's publish.
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await expect(adminConfigRepository.patch({ factorySync: { enabled: true } }, config, usage)).rejects.toMatchObject({
      code: 'sync-switch-blocked',
    });
    const [year, month] = currentMonthKey.split('-').map(Number) as [number, number];
    const nextKey = `${month === 12 ? year + 1 : year}-${String((month % 12) + 1).padStart(2, '0')}`;
    setMockNow(new Date(Date.UTC(year, month + 1, 10, 6)));
    await signInAs(CLERK);
    await factoryRecordRepository.importRows('bills', 'next-a.xlsx', [
      { ...row(first!.supplierCode, '2026300010'), month: nextKey },
    ]);
    await signInAs(MANAGER);
    await expect(monthRepository.publish(nextKey)).rejects.toMatchObject({
      code: 'earlier-month-unpublished',
      details: { monthKey: currentMonthKey },
    });

    expect((await monthRepository.get(currentMonthKey)).lateBills).toBe(1);
    expect((await billRepository.get(`bill-${currentMonthKey}-${third!.id}`)).publishedAt).toBeNull();
    // The manager publishes the late bills with the same call.
    await monthRepository.publish(currentMonthKey);
    expect((await billRepository.get(`bill-${currentMonthKey}-${third!.id}`)).publishedAt).not.toBeNull();
    expect((await monthRepository.get(currentMonthKey)).lateBills).toBe(0);
    await expect(monthRepository.publish(currentMonthKey)).rejects.toMatchObject({ code: 'already-published' });
    // Then the next month goes out.
    await monthRepository.publish(nextKey);
  }, 20_000);
});

describe('the approvals check, and the two races', () => {
  const NOTE = 'Checked against the leaf already weighed this month at the counter.';
  /** The template slip without its Rs. 40,000 advance, still adding up. */
  const withoutAdvance = (code: string) => ({
    ...slip(),
    month: currentMonthKey,
    supplierCode: code,
    billNo: '2026300100',
    advance: '0',
    totalDeductions: '6418',
    balanceAmount: '108226.91',
    finalBalance: '108220',
  });

  it('refuses a slip that lacks what we approved, at the import and again at the publish', async () => {
    await importingFactory();
    await signInAs(MANAGER);
    const request = await creditRepository.get('crd-1'); // an advance, pending
    const supplier = await supplierRepository.get(request.supplierId);

    // Without its advance line the slip lacks the advance this supplier already had approved
    // this month (in the fixture), so it is refused, naming the line and the rupees.
    const refused = await factoryRecordRepository.importRows('bills', 'a.xlsx', [withoutAdvance(supplier.supplierCode)]);
    expect(refused).toMatchObject({ saved: 0, problems: [{ row: 2, column: 'advance', code: 'approval-missing' }] });
    const alreadyApproved = refused.problems[0]!.amount!;
    expect(alreadyApproved).toBeGreaterThan(0);

    // The printed slip, whose Rs. 40,000 advance covers it, goes in.
    const printed = { ...slip(), month: currentMonthKey, supplierCode: supplier.supplierCode, billNo: '2026300100' };
    await signInAs(CLERK);
    expect(await factoryRecordRepository.importRows('bills', 'a.xlsx', [printed])).toMatchObject({
      saved: 1,
      problems: [],
    });

    // Then the advance is approved for the month, after the file went in.
    await signInAs(MANAGER);
    const eligibility = request.eligibility!;
    await creditRepository.approve(
      'crd-1',
      { note: NOTE, ceilingSeen: eligibility.ceiling },
      { amount: request.amount, available: eligibility.available },
    );

    const approvedNow = Math.round((alreadyApproved + request.amount) * 100) / 100;

    // The same printed slip no longer covers both: refused at the import...
    await signInAs(CLERK);
    expect(await factoryRecordRepository.importRows('bills', 'a.xlsx', [printed])).toMatchObject({
      saved: 0,
      problems: [{ row: 2, column: 'advance', code: 'approval-missing', amount: approvedNow }],
    });

    // ...and the bill already imported is refused again at the publish.
    await signInAs(MANAGER);
    await expect(monthRepository.publish(currentMonthKey)).rejects.toMatchObject({
      code: 'approval-missing',
      details: {
        problems: [{ supplierCode: supplier.supplierCode, column: 'advance', amount: approvedNow }],
        total: 1,
      },
    });
  });

  it('answers records-busy to a decision met by a publish, and asks for a file again', async () => {
    await importingFactory();
    await signInAs(MANAGER);
    const request = await creditRepository.get('crd-1');
    setMockPublishInProgress(true);
    const busy = await creditRepository
      .approve(
        'crd-1',
        { note: NOTE, ceilingSeen: request.eligibility!.ceiling },
        { amount: request.amount, available: request.eligibility!.available },
      )
      .catch((error: unknown) => error);
    expect(busy).toMatchObject({ code: 'records-busy' });
    expect(errorMessageKey(busy)).toBe('error.recordsBusy');
    setMockPublishInProgress(false);

    await signInAs(CLERK);
    const supplier = await supplierRepository.get(request.supplierId);
    mockPublishDuringNextImport();
    const again = await factoryRecordRepository
      .importRows('bills', 'a.xlsx', [withoutAdvance(supplier.supplierCode)])
      .catch((error: unknown) => error);
    expect(again).toMatchObject({ code: 'month-locked', details: { reason: 'published-during-import' } });
    // "Send the file again", not "the month is published".
    expect(errorMessageKey(again)).toBe('error.publishedDuringImport');
  });
});
