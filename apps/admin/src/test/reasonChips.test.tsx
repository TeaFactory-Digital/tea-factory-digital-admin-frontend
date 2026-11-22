/**
 * Reason chips under every reason box (22 November 2026): a chip adds its sentence, a second
 * click takes it out, and a factory that saved its own list (Configuration, Common notes)
 * sees its own chips instead of the built-in ones.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { NOTE_SUGGESTION_KEYS } from '@tfd/domain';
import { DeliveriesScreen } from '@/modules/deliveries/DeliveriesScreen';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { REASON_CHIPS } from '@/components/ReasonChips';
import { clearFactorySync, setFactorySync } from './factorySync';
import { renderWithProviders, signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

beforeEach(() => signOut());
afterEach(() => clearFactorySync());

async function openVoidDialog() {
  await setFactorySync(false);
  await signInAs(CLERK);
  const recent = (await deliveryRepository.list({ pageSize: 1 })).items[0]!;
  renderWithProviders(
    <Routes>
      <Route path="/deliveries" element={<DeliveriesScreen />} />
    </Routes>,
    { route: `/deliveries?date=${recent.date}` },
  );
  const table = await screen.findByRole('table', { name: /Leaf collection/ }, { timeout: 10_000 });
  await userEvent.click(within(table).getAllByRole('button', { name: 'Void' })[0]!);
  return screen.findByRole('dialog');
}

describe('reason chips', () => {
  it('every list is one the factory can edit in Configuration', () => {
    for (const list of Object.keys(REASON_CHIPS)) expect(NOTE_SUGGESTION_KEYS).toContain(list);
  });

  it('add a sentence to the void reason, and take it out again', async () => {
    const user = userEvent.setup();
    const dialog = await openVoidDialog();
    const box = within(dialog).getByLabelText(/Reason/);

    const chip = within(dialog).getByRole('button', { name: 'Entered twice' });
    await user.click(chip);
    expect(box).toHaveValue('The same weighing was entered twice by mistake.');
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await user.click(chip);
    expect(box).toHaveValue('');
  }, 20_000);

  it("offer the factory's own sentences once it has saved some", async () => {
    await setFactorySync(false);
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch(
      {
        noteSuggestions: {
          'deliveries.void': [
            { label: { en: 'Scale fault' }, text: { en: 'The scale showed a wrong figure; reweighed.' } },
          ],
        },
      },
      config,
      usage,
    );
    signOut();

    const dialog = await openVoidDialog();
    expect(within(dialog).getByRole('button', { name: 'Scale fault' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Entered twice' })).not.toBeInTheDocument();
  }, 20_000);
});
