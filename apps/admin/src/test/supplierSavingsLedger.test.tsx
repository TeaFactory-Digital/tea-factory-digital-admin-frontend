/**
 * The supplier record's savings passbook, against `GET /admin/savings/:id/ledger` as the
 * API serves it: a plain array, oldest first, amounts signed.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { SupplierSavingsLedger } from '@/modules/suppliers/SupplierSavingsLedger';
import { renderWithProviders, signInAs, signOut } from './render';

const SERVED = [
  {
    monthKey: '2026-07',
    month: 'JULY 2026',
    amount: 3000,
    balance: 3000,
    source: 'openingBalance',
  },
  {
    monthKey: '2026-08',
    month: 'AUGUST 2026',
    amount: 1500,
    balance: 4500,
    source: 'billDeduction',
  },
  {
    monthKey: '2026-09',
    month: 'SEPTEMBER 2026',
    amount: -2000,
    balance: 2500,
    source: 'withdrawal',
  },
];

beforeEach(() => signOut());

describe('the savings passbook', () => {
  it('shows each line newest first, with the totals in and out', async () => {
    server.use(http.get('*/admin/savings/:id/ledger', () => HttpResponse.json(SERVED)));
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<SupplierSavingsLedger supplierId="sup-1" />);

    const rows = await screen.findAllByRole('row');
    // Header, then September (the withdrawal) first.
    expect(rows[1]).toHaveTextContent('Withdrawal');
    expect(screen.getByText('Paid in').nextSibling).toHaveTextContent('4,500');
    expect(screen.getByText('Taken out').nextSibling).toHaveTextContent('2,000');
    expect(screen.getByText('Balance now').nextSibling).toHaveTextContent('2,500');
  });

  it('is not shown at all for a factory without a savings scheme', async () => {
    server.use(
      http.get('*/admin/savings/:id/ledger', () =>
        HttpResponse.json(
          { code: 'feature-disabled', message: 'off', details: { flag: 'enableSavings' } },
          { status: 403 },
        ),
      ),
    );
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<SupplierSavingsLedger supplierId="sup-1" />);
    // Loading first, then nothing: no title, no error card.
    await waitFor(() => expect(screen.queryByText('Savings passbook')).not.toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByText('Savings passbook')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
