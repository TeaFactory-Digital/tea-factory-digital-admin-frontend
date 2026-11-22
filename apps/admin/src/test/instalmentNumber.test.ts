/**
 * The loan instalment number carries on from the newest numbered bill (backend 29824a0, T17.4):
 * an imported slip counts by the number printed on it, even in a month without leaf, so the
 * factory's paper slips and the bills calculated here stay in one sequence across a switch.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundledConfig } from '@/config/defaults';
import { mockPatchBill } from '@/services/mocks/handlers';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const FACTORY_SYSTEM = 'factory-system@galabodatea.lk';

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
});

describe('the loan instalment number across a switch from imported bills', () => {
  it('carries on from a printed number on a slip without leaf', async () => {
    bundledConfig.factorySync = { enabled: false };
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch({ factorySync: { enabled: false } }, config, usage);

    await signInAs(FACTORY_SYSTEM);
    const months = (await monthRepository.list()).items;
    const open = months.find((one) => one.open)!;
    const published = months.filter((one) => !one.open).sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]!;
    await monthRepository.setRate(open.monthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
    await billRepository.generate(open.monthKey);

    // A supplier whose bill this month repays some of a loan.
    const current = (await billRepository.list({ monthKey: open.monthKey, pageSize: 500 })).items;
    const withLoan = (
      await Promise.all(current.map((one) => billRepository.get(one.id)))
    ).find((bill) => bill.loanInstalmentNo !== null && bill.loanInstalmentNo !== undefined)!;

    // Last month's bill becomes an imported slip with no leaf, printed "Loans / Advance 4".
    const last = (await billRepository.list({ monthKey: published.monthKey, pageSize: 500 })).items.find(
      (one) => one.supplierId === withLoan.supplierId,
    )!;
    mockPatchBill(last.id, { source: 'imported', totalKgs: 0, loanInstalmentNo: 4 });

    await billRepository.generate(open.monthKey);
    expect((await billRepository.get(withLoan.id)).loanInstalmentNo).toBe(5);
  }, 20_000);
});
