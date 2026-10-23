/**
 * Comparing bills calculated here with the slips the factory's own system printed, and
 * holding the ones that differ (docs/v2/factory-records.md §5).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { compareWithSlip, slipComparisonBlocks, type SlipComparisonRow } from '@tfd/domain';
import { MonthCloseScreen } from '@/modules/months/MonthCloseScreen';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { bundledConfig } from '@/config/defaults';
import { mockHoldPublishedBill } from '@/services/mocks/handlers';
import type * as ServerReady from '@/lib/serverReady';
import { renderWithProviders, signInAs, signOut } from './render';

// The API has not built these yet, so the console hides them; here they are shown.
vi.mock('@/lib/serverReady', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerReady>()),
  SLIP_COMPARISON_ON_SERVER: true,
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

/** The open month, with a rate, no open exceptions and a bill run: ready but for the slips. */
async function readyMonth() {
  await signInAs(FACTORY_SYSTEM);
  const month = (await monthRepository.list()).items.find((one) => one.open)!;
  await monthRepository.setRate(month.monthKey, { ratePerKg: 118.75, extraRatePerKg: 6 });
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
  const bills = (await billRepository.list({ monthKey: month.monthKey, pageSize: 500 })).items;
  return { monthKey: month.monthKey, bills };
}

/** Every printed figure equal to ours, except `differ`, printed `by` rupees less. */
async function importPrinted(monthKey: string, bills: { supplierCode: string; finalBalance: number | null }[], differ?: string, by = 10) {
  await signInAs(CLERK);
  await factoryRecordRepository.importRows(
    'printedBalances',
    'slips.csv',
    bills.map((bill) => ({
      month: monthKey,
      supplierCode: bill.supplierCode,
      finalBalance: String((bill.finalBalance ?? 0) - (bill.supplierCode === differ ? by : 0)),
    })),
  );
}

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
});

describe('the comparison rule', () => {
  it('matches to the rupee, and calls a figure never entered missing', () => {
    expect(compareWithSlip(68220, 68220)).toBe('match');
    expect(compareWithSlip(68220.004, 68220)).toBe('match');
    expect(compareWithSlip(68230, 68220)).toBe('mismatch');
    expect(compareWithSlip(68220, null)).toBe('missing');
    expect(compareWithSlip(null, 0)).toBe('match');
  });

  it('lets a month go out only when every bill matches or is held', () => {
    const row = (status: SlipComparisonRow['status'], held: boolean) =>
      ({ status, held }) as SlipComparisonRow;
    expect(slipComparisonBlocks([row('match', false), row('mismatch', true)])).toHaveLength(0);
    expect(slipComparisonBlocks([row('missing', false), row('mismatch', true)])).toHaveLength(1);
  });
});

describe('a factory that calculates its bills here', () => {
  it('refuses to publish until every bill matches its printed slip or is held', async () => {
    await setSyncOff();
    const { monthKey, bills } = await readyMonth();

    await signInAs(MANAGER);
    const before = await billRepository.slipComparison(monthKey);
    expect(before.counts.missing).toBe(bills.length);
    await expect(monthRepository.publish(monthKey)).rejects.toMatchObject({
      code: 'bills-mismatch',
      details: { count: bills.length },
    });

    const odd = bills[0]!;
    await importPrinted(monthKey, bills, odd.supplierCode);
    await signInAs(MANAGER);
    const compared = await billRepository.slipComparison(monthKey);
    expect(compared.counts).toMatchObject({ match: bills.length - 1, mismatch: 1, missing: 0 });
    expect(compared.rows).toEqual([
      expect.objectContaining({ billId: odd.id, status: 'mismatch', difference: 10, held: false }),
    ]);
    await expect(monthRepository.publish(monthKey)).rejects.toMatchObject({ code: 'bills-mismatch' });

    await signInAs(CLERK);
    await expect(billRepository.hold(odd.id, 'short')).rejects.toMatchObject({ code: 'invalid' });
    await billRepository.hold(odd.id, 'Rs. 10 short on the printed slip; checking the stamps line');
    expect((await billRepository.list({ monthKey, pageSize: 500 })).items.find((one) => one.id === odd.id)?.held).toBe(true);

    await signInAs(MANAGER);
    await monthRepository.publish(monthKey);
    // The held bill stayed behind; the rest went out.
    expect((await billRepository.get(odd.id)).publishedAt).toBeNull();
    expect((await billRepository.get(bills[1]!.id)).publishedAt).not.toBeNull();
  }, 20_000);

  it('keeps a held bill open after the publish, then releases and publishes it alone', async () => {
    await setSyncOff();
    const { monthKey, bills } = await readyMonth();
    const odd = bills.find((one) => (one.finalBalance ?? 0) > 100)!;
    const other = bills.find((one) => one.id !== odd.id)!;
    await importPrinted(monthKey, bills, odd.supplierCode, 50);
    await signInAs(CLERK);
    await billRepository.hold(odd.id, 'Society fee of Rs. 50 is only on the printed slip');
    await signInAs(MANAGER);
    await monthRepository.publish(monthKey);

    // Still mismatched: not released.
    await expect(billRepository.release(odd.id)).rejects.toMatchObject({ code: 'bill-still-mismatched' });

    // The fix: the other deductions line the factory's system had, on the held bill only.
    await signInAs(CLERK);
    await factoryRecordRepository.adjustBill(odd.id, { otherCards: 50, otherCardsNote: 'Society membership fee' });
    await expect(
      factoryRecordRepository.adjustBill(other.id, { otherCards: 50, otherCardsNote: 'Society membership fee' }),
    ).rejects.toMatchObject({ code: 'month-locked' });

    // Recalculating a published month touches the held bill alone, and keeps its fix.
    await signInAs(FACTORY_SYSTEM);
    const publishedOther = await billRepository.get(other.id);
    await billRepository.generate(monthKey);
    expect(await billRepository.get(other.id)).toEqual(publishedOther);
    expect((await billRepository.get(odd.id)).deductions.otherCards).toBe(50);

    await signInAs(MANAGER);
    const comparison = await billRepository.slipComparison(monthKey);
    expect(comparison.rows.find((row) => row.billId === odd.id)).toMatchObject({ status: 'match', held: true });
    const released = await billRepository.release(odd.id);
    expect(released.published).toBe(true);
    expect((await billRepository.get(odd.id)).publishedAt).not.toBeNull();
    await expect(billRepository.release(odd.id)).rejects.toMatchObject({ code: 'bill-not-held' });
  }, 20_000);

  it('holds the next bill too while an earlier one is held, and releases them in order', async () => {
    await setSyncOff();
    // The newest published month, with this supplier's bill held at its publish.
    await signInAs(MANAGER);
    const earlierMonth = (await monthRepository.list()).items.find((one) => !one.open)!;
    const earlierBills = (await billRepository.list({ monthKey: earlierMonth.monthKey, pageSize: 500 })).items;
    const { monthKey, bills } = await readyMonth();
    const current = bills.find((one) => earlierBills.some((e) => e.supplierId === one.supplierId))!;
    const earlier = earlierBills.find((one) => one.supplierId === current.supplierId)!;
    mockHoldPublishedBill(earlier.id, 'Stamps line differs from the printed slip');

    // Re-run the open month: this supplier's bill is held automatically, nobody else's.
    await signInAs(FACTORY_SYSTEM);
    await billRepository.generate(monthKey);
    await signInAs(MANAGER);
    const comparison = await billRepository.slipComparison(monthKey);
    expect(comparison.rows.find((row) => row.billId === current.id)).toMatchObject({
      held: true,
      holdReason: null,
      heldForMonth: earlier.monthKey,
    });
    expect(comparison.counts.held).toBe(1);

    // Not before the earlier one.
    await expect(billRepository.release(current.id)).rejects.toMatchObject({
      code: 'earlier-bill-held',
      details: { monthKey: earlier.monthKey },
    });

    // Release the earlier one, once it matches its slip.
    await signInAs(CLERK);
    const earlierBill = await billRepository.get(earlier.id);
    await billRepository.setPrinted(earlier.id, earlierBill.finalBalance);
    await signInAs(MANAGER);
    expect((await billRepository.release(earlier.id)).published).toBe(true);

    // This month was calculated before that release: recalculate, compare, release.
    await signInAs(CLERK);
    await billRepository.setPrinted(current.id, (await billRepository.get(current.id)).finalBalance);
    await signInAs(MANAGER);
    await expect(billRepository.release(current.id)).rejects.toMatchObject({ code: 'bills-stale' });
    await signInAs(FACTORY_SYSTEM);
    await billRepository.generate(monthKey);
    await signInAs(CLERK);
    await billRepository.setPrinted(current.id, (await billRepository.get(current.id)).finalBalance);
    await signInAs(MANAGER);
    expect(await billRepository.release(current.id)).toMatchObject({ held: false, published: false });
  }, 20_000);

  it('lists the bills that differ on Rates & month close', async () => {
    await setSyncOff();
    const { monthKey, bills } = await readyMonth();
    const odd = bills[0]!;
    await importPrinted(monthKey, bills, odd.supplierCode);
    await signInAs(MANAGER);

    renderWithProviders(
      <Routes>
        <Route path="/months" element={<MonthCloseScreen />} />
      </Routes>,
      { route: `/months?month=${monthKey}` },
    );

    const table = await screen.findByRole('table', { name: 'Compare with printed slips' }, { timeout: 10_000 });
    const row = within(table).getByText(odd.supplierCode).closest('tr')!;
    expect(within(row).getByText('Does not match')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Hold' })).toBeInTheDocument();
    expect(await screen.findByText('Matches the printed slips')).toBeInTheDocument();
  }, 20_000);
});
