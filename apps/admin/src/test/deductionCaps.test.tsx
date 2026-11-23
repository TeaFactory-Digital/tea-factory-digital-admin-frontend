/**
 * The deduction rates card offers a monthly cap for the loan and manure only. An advance is
 * taken back in full on its month's bill (decided 10 November 2026), so a field for its
 * share would change nothing; its stored share still travels back unchanged.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeductionRatesCard } from '@/modules/months/DeductionRatesCard';
import { deductionRateRepository } from '@/services/repositories/deductionRateRepository';
import { renderWithProviders, signInAs, signOut } from './render';

const MANAGER = 'manager@galabodatea.lk';

beforeEach(() => signOut());

describe('the monthly caps', () => {
  it('has fields for the loan and manure, none for the advance, and keeps the advance share', async () => {
    await signInAs(MANAGER);
    const before = (await deductionRateRepository.get()).rates;
    renderWithProviders(<DeductionRatesCard />);

    const loan = await screen.findByLabelText('Loan', undefined, { timeout: 10_000 });
    expect(screen.getByLabelText('Manure')).toBeInTheDocument();
    expect(screen.queryByLabelText('Advance')).not.toBeInTheDocument();
    // Said behind the caps' "i" (24 November 2026), on hover or focus.
    await userEvent.hover(screen.getByRole('button', { name: /More information: Most a credit may take/ }));
    expect((await screen.findAllByText(/An advance has no cap/)).length).toBeGreaterThan(0);
    await userEvent.unhover(screen.getByRole('button', { name: /More information: Most a credit may take/ }));

    await userEvent.clear(loan);
    await userEvent.type(loan, '25');
    await userEvent.type(screen.getByLabelText(/Reason/), 'The factory raised the loan share this season.');
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));

    await waitFor(async () => {
      const pending = (await deductionRateRepository.get()).pending;
      expect(pending?.proposed.instalmentShares.loan).toBe(0.25);
      expect(pending?.proposed.instalmentShares.advance).toBe(before.instalmentShares.advance);
    });
  }, 20_000);
});
