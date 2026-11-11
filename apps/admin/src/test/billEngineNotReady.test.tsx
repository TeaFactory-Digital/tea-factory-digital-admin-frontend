/**
 * BILL_ENGINE_ON_SERVER both ways. Off (a server without the bill engine), neither way of
 * working may end in an error: Configuration does not offer "Calculated" to a factory on
 * imported bills, and a factory on calculated bills (or with no bill source saved, which
 * reads as calculated) is told to import rather than shown a Generate button that would
 * answer 404. On (backend 221a1c0), both ways are offered and Generate is there.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ServerReady from '@/lib/serverReady';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { bundledConfig } from '@/config/defaults';
import { ConfigurationScreen } from '@/modules/configuration/ConfigurationScreen';
import { MonthCloseScreen } from '@/modules/months/MonthCloseScreen';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { renderWithProviders, signInAs, signOut } from './render';

const engine = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/serverReady', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerReady>()),
  get BILL_ENGINE_ON_SERVER() {
    return engine.on;
  },
}));

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

async function billsFrom(source: 'calculated' | 'imported') {
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
  engine.on = false;
});

describe('bills calculated here, before the API calculates them', () => {
  it('does not offer "Calculated" to a factory that imports its bills', async () => {
    await billsFrom('imported');
    renderWithProviders(<ConfigurationScreen />, { route: '/configuration?section=billCalculation' });

    await userEvent.click(await screen.findByRole('combobox', { name: 'Where the bills come from' }, { timeout: 10_000 }));
    const soon = await screen.findByRole('option', { name: 'Calculated in this console (coming soon)' });
    expect(soon).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Calculating the bills here is not ready yet\. Until it is/)).toBeInTheDocument();
  }, 20_000);

  it('tells a factory already on "Calculated" to import instead', async () => {
    await billsFrom('calculated');
    renderWithProviders(<ConfigurationScreen />, { route: '/configuration?section=billCalculation' });

    // Still the saved value, so it shows; the notice says why it makes no bills.
    expect(
      await screen.findByRole('combobox', { name: 'Where the bills come from' }, { timeout: 10_000 }),
    ).toHaveTextContent('Calculated in this console (coming soon)');
    expect(screen.getByText(/so no bill can be made this way/)).toBeInTheDocument();
  }, 20_000);

  it('shows no Generate button on Rates & month close, only why', async () => {
    await billsFrom('calculated');
    await signInAs(MANAGER);
    const month = (await monthRepository.list()).items.find((one) => one.open)!;

    renderWithProviders(
      <Routes>
        <Route path="/months" element={<MonthCloseScreen />} />
      </Routes>,
      { route: `/months?month=${month.monthKey}` },
    );

    expect(await screen.findByText(/Bills cannot be calculated in this console yet/, undefined, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate the bills' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Recalculate/ })).not.toBeInTheDocument();
  }, 20_000);
});

describe('bills calculated here, once the API calculates them', () => {
  it('offers both ways in Configuration, with no notice', async () => {
    engine.on = true;
    await billsFrom('imported');
    renderWithProviders(<ConfigurationScreen />, { route: '/configuration?section=billCalculation' });

    await userEvent.click(await screen.findByRole('combobox', { name: 'Where the bills come from' }, { timeout: 10_000 }));
    const calculated = await screen.findByRole('option', { name: 'Calculated in this console' });
    expect(calculated).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText(/Calculating the bills here is not ready yet/)).not.toBeInTheDocument();
  }, 20_000);

  it('offers Generate on Rates & month close', async () => {
    engine.on = true;
    await billsFrom('calculated');
    await signInAs(MANAGER);
    const month = (await monthRepository.list()).items.find((one) => one.open)!;

    renderWithProviders(
      <Routes>
        <Route path="/months" element={<MonthCloseScreen />} />
      </Routes>,
      { route: `/months?month=${month.monthKey}` },
    );

    expect(
      await screen.findByRole('button', { name: /Generate the bills|Re-generate the bills/ }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Bills cannot be calculated in this console yet/)).not.toBeInTheDocument();
  }, 20_000);
});
