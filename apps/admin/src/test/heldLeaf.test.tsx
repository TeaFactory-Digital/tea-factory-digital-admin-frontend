/**
 * Commit B (backend e164e2f) and the answers of 17 November 2026:
 *
 * - a held supplier's leaf can still be corrected in a published month (factory-records §5,
 *   step 6), and the leaf screen offers it for them alone;
 * - their month has no 30-day limit;
 * - under `withinInstalment`, the last instalment clears the loan, and interest still carried
 *   after the principal is repaid is taken on the next bill (T15.10, T14.5).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { leafDateProblem, loanRecovery } from '@tfd/domain';
import { bundledConfig } from '@/config/defaults';
import { DeliveriesScreen } from '@/modules/deliveries/DeliveriesScreen';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { mockHoldPublishedBill } from '@/services/mocks/handlers';
import { renderWithProviders, signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

beforeEach(() => signOut());
afterEach(() => {
  delete bundledConfig.factorySync;
});

describe('a held supplier in a published month', () => {
  it('has no 30-day limit on their leaf', () => {
    expect(leafDateProblem('2026-01-05', '2026-11-17')).toBe('too-old');
    expect(leafDateProblem('2026-01-05', '2026-11-17', { held: true })).toBeNull();
    // A day after today is still refused.
    expect(leafDateProblem('2026-11-18', '2026-11-17', { held: true })).toBe('future');
  });

  it('is named and offered the leaf grid while the rest of the month stays locked', async () => {
    bundledConfig.factorySync = { enabled: false };
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch(
      { factorySync: { enabled: false }, billSettings: { paymentUnit: 10, source: 'calculated' } },
      config,
      usage,
    );

    await signInAs(MANAGER);
    const published = (await monthRepository.list()).items.find((one) => !one.open)!;
    const bill = (await billRepository.list({ monthKey: published.monthKey, pageSize: 1 })).items[0]!;
    mockHoldPublishedBill(bill.id, 'Stamps line differs from the printed slip');

    await signInAs(CLERK);
    renderWithProviders(
      <Routes>
        <Route path="/deliveries" element={<DeliveriesScreen />} />
      </Routes>,
      { route: `/deliveries?date=${published.monthKey}-15` },
    );

    expect(
      await screen.findByText(/Leaf can still be entered or voided only for the suppliers whose bill is held/, undefined, {
        timeout: 10_000,
      }),
    ).toHaveTextContent(bill.supplierCode);
    // The weighing sheet is offered, not the lock.
    expect(screen.getByText(/Supplier number, Tab, kilos, Enter/)).toBeInTheDocument();
  }, 20_000);
});

describe('a loan under withinInstalment', () => {
  const within = { monthlyRatePercent: 1, recovery: 'withinInstalment' } as const;

  it('is cleared by its last instalment', () => {
    // Rs. 1,000 still owed at 1%: the instalment takes the Rs. 10 interest and all of the rest.
    expect(loanRecovery(1000, 5000, within)).toEqual({
      interest: 10,
      deducted: 1010,
      principalRepaid: 1000,
      interestCarried: 0,
    });
  });

  it('takes interest still carried after the principal is repaid on the next bill', () => {
    expect(loanRecovery(0, 5000, within, 200)).toEqual({
      interest: 0,
      deducted: 200,
      principalRepaid: 0,
      interestCarried: 0,
    });
  });
});
