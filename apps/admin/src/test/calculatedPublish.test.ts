/**
 * The mock answers a calculated month's publish as the API's bill engine does (backend
 * 221a1c0): not before the month has ended, and stale bill by bill, naming the suppliers
 * whose bill generating again would change.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundledConfig } from '@/config/defaults';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { afterMonthEnds } from './clock';
import { signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const FACTORY_SYSTEM = 'factory-system@galabodatea.lk';

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
});

async function readyCalculatedMonth() {
  bundledConfig.factorySync = { enabled: false };
  await signInAs(ADMIN);
  const { config, usage } = await adminConfigRepository.get();
  await adminConfigRepository.patch({ factorySync: { enabled: false } }, config, usage);
  await signInAs(FACTORY_SYSTEM);
  const month = (await monthRepository.list()).items.find((one) => one.open)!;
  await monthRepository.setRate(month.monthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
  const open = await monthRepository.exceptions(month.monthKey, { resolved: false });
  for (const exception of open.items) {
    await monthRepository.resolveException(month.monthKey, exception.id, 'Checked against the counter records.');
  }
  await billRepository.generate(month.monthKey);
  return month.monthKey;
}

describe('publishing a calculated month', () => {
  it('waits for the month to end', async () => {
    const monthKey = await readyCalculatedMonth();
    await signInAs(MANAGER);
    await expect(monthRepository.publish(monthKey)).rejects.toMatchObject({
      code: 'month-not-ended',
      details: { monthKey },
    });
  }, 20_000);

  it('names the suppliers whose bill would change', async () => {
    const monthKey = await readyCalculatedMonth();
    await signInAs(FACTORY_SYSTEM);
    const bill = (await billRepository.list({ monthKey, pageSize: 1 })).items[0]!;
    const weighing = (await deliveryRepository.list({ supplierId: bill.supplierId, pageSize: 200 })).items.find(
      (one) => one.monthKey === monthKey && !one.voidedAt,
    )!;
    await deliveryRepository.void(weighing.id, 'Entered twice by mistake.');

    const run = await billRepository.run(monthKey);
    expect(run).toMatchObject({ stale: true, reasons: ['figures'], staleSuppliers: [bill.supplierCode] });

    await signInAs(MANAGER);
    afterMonthEnds(monthKey);
    await expect(monthRepository.publish(monthKey)).rejects.toMatchObject({
      code: 'bills-stale',
      details: { suppliers: [bill.supplierCode], count: 1, reason: 'figures' },
    });
  }, 20_000);
});
