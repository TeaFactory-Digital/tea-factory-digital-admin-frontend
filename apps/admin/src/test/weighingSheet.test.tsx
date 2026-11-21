/**
 * The weighing sheet (rebuilt 21 November 2026): many suppliers at many collection points in
 * as few keystrokes as possible. Supplier, Enter, kilos, Enter; the point fills in from the
 * supplier and can be changed on the line; Ctrl+Enter records one batch per point; a line is
 * corrected in place; lines pasted from a spreadsheet are matched, and a bad one is named.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import type { SupplierListItem } from '@tfd/domain';
import { DeliveriesScreen } from '@/modules/deliveries/DeliveriesScreen';
import { colomboToday } from '@/lib/format';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { clearFactorySync, setFactorySync } from './factorySync';
import { renderWithProviders, signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';

beforeEach(() => signOut());
afterEach(() => clearFactorySync());

/** Two active suppliers registered at different collection points. */
async function twoSuppliers(): Promise<[SupplierListItem, SupplierListItem]> {
  await signInAs(CLERK);
  const all = (await supplierRepository.list({ status: 'active', pageSize: 200 })).items;
  const first = all.find((one) => one.collectionPoint)!;
  const second = all.find((one) => one.collectionPoint && one.collectionPoint.name !== first.collectionPoint!.name)!;
  return [first, second];
}

async function openSheet() {
  await setFactorySync(false);
  await signInAs(CLERK);
  const today = colomboToday();
  renderWithProviders(
    <Routes>
      <Route path="/deliveries" element={<DeliveriesScreen />} />
    </Routes>,
    { route: `/deliveries?date=${today}` },
  );
  const code = await screen.findByLabelText('Supplier code', undefined, { timeout: 10_000 });
  return { today, code };
}

/** The bare number: `5007 (DENIYAYA)` is typed as `5007`. */
const bare = (supplier: SupplierListItem) => supplier.supplierCode.replace(/\s*\(.*\)$/, '');

async function enterLine(user: ReturnType<typeof userEvent.setup>, code: HTMLElement, supplier: SupplierListItem, kgs: string) {
  await user.type(code, bare(supplier));
  // The match shows under the field (the name may also be in the recorded rows below).
  await screen.findByText(supplier.name, { selector: '.text-success' }, { timeout: 5_000 });
  await user.keyboard('{Enter}');
  // Enter moved the caret to the kilos.
  expect(screen.getByLabelText('Kilos')).toHaveFocus();
  await user.keyboard(`${kgs}{Enter}`);
  await waitFor(() => expect(code).toHaveFocus());
}

describe('the weighing sheet', () => {
  it('takes two suppliers at two points by keyboard and records one batch per point', async () => {
    const user = userEvent.setup();
    const [first, second] = await twoSuppliers();
    const { today, code } = await openSheet();
    const before = (await deliveryRepository.list({ date: today, pageSize: 500 })).total;

    await enterLine(user, code, first, '120');
    await enterLine(user, code, second, '45.5');

    const sheet = screen.getByRole('region', { name: /Not recorded yet: 2 lines/ });
    // Each line took its supplier's own point.
    expect(within(sheet).getByRole('combobox', { name: 'Collection point, line 1' })).toHaveTextContent(new RegExp(first.collectionPoint!.name, 'i'));
    expect(within(sheet).getByRole('combobox', { name: 'Collection point, line 2' })).toHaveTextContent(new RegExp(second.collectionPoint!.name, 'i'));

    // A figure corrected in place.
    const kilos2 = within(sheet).getByLabelText('Kilos, line 2');
    await user.clear(kilos2);
    await user.type(kilos2, '46');

    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(async () => {
      const recorded = (await deliveryRepository.list({ date: today, pageSize: 500 })).items;
      expect(recorded.length).toBe(before + 2);
      expect(recorded.find((one) => one.supplierId === first.id && one.kgs === 120)?.collectionPoint?.toLowerCase()).toBe(first.collectionPoint!.name.toLowerCase());
      expect(recorded.find((one) => one.supplierId === second.id && one.kgs === 46)?.collectionPoint?.toLowerCase()).toBe(second.collectionPoint!.name.toLowerCase());
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: /Not recorded yet/ })).not.toBeInTheDocument());
  }, 30_000);

  it('adds pasted spreadsheet lines and names the ones it cannot match', async () => {
    const user = userEvent.setup();
    const [first, second] = await twoSuppliers();
    const { code } = await openSheet();

    await user.click(code);
    await user.paste(`Supplier\tKilos\n${bare(first)}\t100\n${bare(second)}\t80.25\t${first.collectionPoint!.name}\n99999\t50\n${bare(first)}\tabc`);

    const sheet = await screen.findByRole('region', { name: /Not recorded yet: 2 lines/ }, { timeout: 10_000 });
    // The point named on the pasted line wins over the supplier's own.
    expect(within(sheet).getByRole('combobox', { name: 'Collection point, line 2' })).toHaveTextContent(new RegExp(first.collectionPoint!.name, 'i'));
    const report = screen.getByRole('status');
    expect(report).toHaveTextContent('2 lines added from the paste.');
    expect(report).toHaveTextContent('2 not added');
    expect(report).toHaveTextContent('no active supplier 99999');
    expect(report).toHaveTextContent('the kilos are not a weight');
  }, 30_000);
});
