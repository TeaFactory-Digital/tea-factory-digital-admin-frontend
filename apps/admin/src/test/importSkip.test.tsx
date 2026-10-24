/**
 * Importing a file again without doubling anything: leaf already recorded and suppliers
 * already on the roll are skipped, not refused (docs/v2/factory-records.md §4.2).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { leafRecordKey, matchRecorded } from '@tfd/domain';
import { ImportDialog } from '@/components/ImportDialog';
import { bundledConfig } from '@/config/defaults';
import type * as ServerReady from '@/lib/serverReady';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { renderWithProviders, signInAs, signOut } from './render';

// The API has not built these yet, so the console asks for no preview; here it does.
vi.mock('@/lib/serverReady', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerReady>()),
  IMPORT_SKIP_ON_SERVER: true,
}));

const ADMIN = 'factoryadmin@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

async function setSyncOff() {
  bundledConfig.factorySync = { enabled: false };
  await signInAs(ADMIN);
  const { config, usage } = await adminConfigRepository.get();
  await adminConfigRepository.patch({ factorySync: { enabled: false } }, config, usage);
  await signInAs(CLERK);
}

const today = () => new Date().toISOString().slice(0, 10);

async function someSupplier() {
  const known = (await supplierRepository.list({ status: 'active', pageSize: 1 })).items[0]!;
  return { ...known, bare: known.supplierCode.split(' ')[0]! };
}

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
});

describe('matching a weighing already recorded', () => {
  it('matches by count, so a real second weighing of the same kilos still counts', () => {
    const a = leafRecordKey('2026-10-08', 'sup-1', 20, 'deniyaya');
    const b = leafRecordKey('2026-10-08', 'sup-1', 20.5, 'DENIYAYA');
    expect(a).toBe(leafRecordKey('2026-10-08', 'sup-1', 20.0, 'DENIYAYA'));
    expect(matchRecorded([a], [a, a, b])).toEqual([0]);
    expect(matchRecorded([a, a, b], [a, a, b])).toEqual([0, 1, 2]);
    expect(matchRecorded([], [a])).toEqual([]);
  });
});

describe('importing a file again', () => {
  it('skips leaf already recorded, unless told to import it anyway', async () => {
    await setSyncOff();
    const { bare } = await someSupplier();
    const rows = [
      { date: today(), supplierCode: bare, kg: '17.3' },
      { date: today(), supplierCode: bare, kg: '9.8' },
    ];
    const count = async () => (await deliveryRepository.list({ date: today(), pageSize: 500 })).total;
    const start = await count();

    expect(await factoryRecordRepository.importRows('deliveries', 'day.csv', rows)).toMatchObject({ saved: 2, skippedTotal: 0 });

    // The same file, with one more weighing: only the new one is saved.
    const again = [...rows, { date: today(), supplierCode: bare, kg: '11.2' }];
    const preview = await factoryRecordRepository.importRows('deliveries', 'day.csv', again, { dryRun: true });
    expect(preview).toMatchObject({ dryRun: true, saved: 1, skipped: [{ row: 2, code: 'already-recorded' }, { row: 3, code: 'already-recorded' }] });
    expect(await count()).toBe(start + 2);

    expect(await factoryRecordRepository.importRows('deliveries', 'day.csv', again)).toMatchObject({ saved: 1, skippedTotal: 2 });
    expect(await count()).toBe(start + 3);

    // A real second weighing of the same kilos, kept on purpose.
    const kept = await factoryRecordRepository.importRows('deliveries', 'day.csv', [rows[0]!], { duplicates: 'import' });
    expect(kept).toMatchObject({ saved: 1, skippedTotal: 0 });
    expect(await count()).toBe(start + 4);
  });

  it('leaves a supplier already on the roll as they are, and adds the new one', async () => {
    await setSyncOff();
    const known = await someSupplier();
    const point = known.collectionPoint?.name ?? '';
    const rows = [
      { supplierCode: known.bare, name: 'Somebody Else', nic: '883210456V', collectionPoint: point, paymentMethod: 'cash' },
      { supplierCode: '98765', name: 'New Supplier', nic: '901234567V', collectionPoint: point, paymentMethod: 'cash' },
    ];

    const result = await factoryRecordRepository.importRows('suppliers', 'roll.csv', rows);
    expect(result).toMatchObject({ saved: 1, problems: [], skipped: [{ row: 2, code: 'supplier-exists' }] });
    // Not updated from the file.
    expect((await supplierRepository.get(known.id)).name).toBe(known.name);
  });

  it('finds 0708 from a 708 a spreadsheet wrote, and will not add 708 beside it', async () => {
    await setSyncOff();
    const point = (await someSupplier()).collectionPoint?.name ?? '';
    const roll = (code: string, name: string) => ({ supplierCode: code, name, nic: '901234567V', collectionPoint: point, paymentMethod: 'cash' });
    expect(await factoryRecordRepository.importRows('suppliers', 'roll.csv', [roll('0708', 'Leading Zero')])).toMatchObject({ saved: 1 });

    // The same digits are the same supplier: skipped, not added again.
    expect(await factoryRecordRepository.importRows('suppliers', 'roll.csv', [roll('708', 'Leading Zero')])).toMatchObject({
      saved: 0,
      skipped: [{ row: 2, code: 'supplier-exists' }],
    });
    // A leaf file whose code lost its zero still finds them.
    expect(
      await factoryRecordRepository.importRows('deliveries', 'day.csv', [{ date: today(), supplierCode: '708', kg: '12.4' }]),
    ).toMatchObject({ saved: 1, problems: [] });
  });

  it('tells the office before importing, and lets it keep a second weighing', async () => {
    await setSyncOff();
    const user = userEvent.setup();
    const { bare } = await someSupplier();
    const csv = `date,supplierCode,kg\n${today()},${bare},13.7\n${today()},${bare},8.4\n`;
    await factoryRecordRepository.importRows('deliveries', 'first.csv', [
      { date: today(), supplierCode: bare, kg: '13.7' },
      { date: today(), supplierCode: bare, kg: '8.4' },
    ]);

    renderWithProviders(<ImportDialog kind="deliveries" open onClose={() => {}} />);
    await user.upload(
      screen.getByLabelText(/Choose an Excel or CSV file/),
      new File([csv], 'again.csv', { type: 'text/csv' }),
    );

    expect(
      await screen.findByText('Everything in this file is already recorded. There is nothing new to import.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Rows: 2, 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 rows' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Import 2 rows' }));
    expect(await screen.findAllByText('2 rows imported')).not.toHaveLength(0);
  }, 15_000);
});
