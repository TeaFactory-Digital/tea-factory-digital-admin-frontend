/**
 * Other deductions (#45 step 4) as the API built them (backend b6c10d6, 6 November 2026):
 * only on a calculated bill, the import refused before a row is read where the bills are
 * imported, and one supplier twice in a month found by who it is, not by the text.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundledConfig } from '@/config/defaults';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

async function factoryWhoseBills(source: 'calculated' | 'imported') {
  bundledConfig.factorySync = { enabled: false };
  await signInAs(ADMIN);
  const { config, usage } = await adminConfigRepository.get();
  await adminConfigRepository.patch(
    { factorySync: { enabled: false }, billSettings: { paymentUnit: 10, source } },
    config,
    usage,
  );
}

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
});

describe('the other deductions import', () => {
  it('refuses a factory that imports its bills before reading a row', async () => {
    await factoryWhoseBills('imported');
    await signInAs(MANAGER);
    await expect(
      factoryRecordRepository.importRows('billAdjustments', 'deductions.csv', [
        { month: '2026-01', supplierCode: 'nobody', otherCards: '100', otherCardsNote: 'Canteen' },
      ]),
    ).rejects.toMatchObject({ status: 409, code: 'wrong-bill-source' });
  }, 20_000);

  it('finds one supplier twice in a month by who it is: 0708 is 708', async () => {
    await factoryWhoseBills('calculated');
    await signInAs(MANAGER);
    const published = (await monthRepository.list()).items.find((one) => !one.open)!;
    const bill = (await billRepository.list({ monthKey: published.monthKey, pageSize: 1 })).items[0]!;
    const supplier = await supplierRepository.get(bill.supplierId);
    const bare = /^(\d+)/.exec(supplier.supplierCode)![1]!;

    const result = await factoryRecordRepository.importRows('billAdjustments', 'deductions.csv', [
      { month: published.monthKey, supplierCode: bare, otherCards: '100', otherCardsNote: 'Canteen' },
      { month: published.monthKey, supplierCode: `0${bare}`, otherCards: '50', otherCardsNote: 'Canteen' },
    ]);
    expect(result.saved).toBe(0);
    // The first row meets the published month; the second is the same supplier again.
    expect(result.problems).toEqual([
      { row: 2, column: 'month', code: 'month-locked' },
      { row: 3, column: 'supplierCode', code: 'duplicate' },
    ]);
  }, 20_000);
});
