/**
 * The bill screen at a glance (24 November 2026): four of the slip's own totals above the
 * cards, every deduction line still printed (zeros quieter, never missing), and the card
 * descriptions behind an "i".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { DEDUCTION_CATEGORIES } from '@tfd/domain';
import { BillDetailScreen } from '@/modules/bills/BillDetailScreen';
import { billRepository } from '@/services/repositories/billRepository';
import { formatMoney } from '@/lib/format';
import { renderWithProviders, signInAs, signOut } from './render';

const MANAGER = 'manager@galabodatea.lk';

async function aPublishedBill() {
  const months = await billRepository.months();
  const closed = months.find((month) => !month.open && month.billCount > 0)!;
  const page = await billRepository.list({ monthKey: closed.monthKey, pageSize: 1 });
  return billRepository.get(page.items[0]!.id);
}

beforeEach(() => {
  signOut();
});

describe('the bill screen', () => {
  it('opens with the slip’s totals, the payable one last', async () => {
    await signInAs(MANAGER);
    const bill = await aPublishedBill();
    renderWithProviders(
      <Routes>
        <Route path="/bills/:id" element={<BillDetailScreen />} />
      </Routes>,
      { route: `/bills/${bill.id}` },
    );

    const strip = await screen.findByLabelText('Bill at a glance');
    const terms = within(strip).getAllByRole('term').map((term) => term.textContent);
    expect(terms).toEqual(['Total kilos', 'Gross amount', 'Total deductions', 'Payable']);
    expect(strip.textContent).toContain(formatMoney(bill.finalBalance));
  });

  it('still prints every deduction line, and explains the cards behind an "i"', async () => {
    await signInAs(MANAGER);
    const bill = await aPublishedBill();
    renderWithProviders(
      <Routes>
        <Route path="/bills/:id" element={<BillDetailScreen />} />
      </Routes>,
      { route: `/bills/${bill.id}` },
    );

    await screen.findByRole('heading', { name: /Deductions/ });
    // Nine lines, zeros included: the document's shape (§18.1).
    const deductions = screen.getByRole('heading', { name: /Deductions/ }).closest('section')!;
    const lines = within(deductions).getAllByRole('term');
    // The nine lines and their total.
    expect(lines).toHaveLength(DEDUCTION_CATEGORIES.length + 1);

    // The long sentences moved off the page.
    expect(screen.queryByText(/The nine lines the printed account carries/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More information: Deductions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More information: Balance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More information: Savings' })).toBeInTheDocument();
  });
});

describe('printing the bill (24 November 2026)', () => {
  it('prints the slip from the browser, with every line, outside the console', async () => {
    await signInAs(MANAGER);
    const bill = await aPublishedBill();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderWithProviders(
      <Routes>
        <Route path="/bills/:id" element={<BillDetailScreen />} />
      </Routes>,
      { route: `/bills/${bill.id}` },
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Print or save PDF' }));
    expect(print).toHaveBeenCalledOnce();

    // Rendered straight into the body, so the console's own frame never cuts it off.
    const slip = document.body.querySelector(':scope > .tfd-print-slip') as HTMLElement;
    expect(slip).toBeTruthy();
    expect(slip.textContent).toContain(bill.billNo);
    expect(slip.textContent).toContain(formatMoney(bill.finalBalance));
    // The nine lines, zeros included, and the total (AC-03).
    expect(within(slip).getByText('Stamps')).toBeInTheDocument();
    expect(within(slip).getByText('Previous debts')).toBeInTheDocument();
    print.mockRestore();
  });
});
