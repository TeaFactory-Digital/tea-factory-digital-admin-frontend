/**
 * The Savings tab of Reports, against `GET /admin/reports/savingsHeld` (BACKEND-TODO #27).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { SavingsReport } from '@/modules/reports/SavingsReport';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('the savings report', () => {
  it('leads with the balance held at the latest month end, and the period totals', async () => {
    server.use(
      http.get('*/admin/reports/savingsHeld', () =>
        HttpResponse.json({
          rows: [
            {
              monthKey: '2026-08',
              paidIn: 120000,
              takenOut: 20000,
              balanceTotal: 900000,
              suppliersSaving: 410,
            },
            {
              monthKey: '2026-09',
              paidIn: 130000,
              takenOut: 30000,
              balanceTotal: 1000000,
              suppliersSaving: 415,
            },
          ],
        }),
      ),
    );
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(<SavingsReport />);

    expect(await screen.findByText('Savings held')).toBeInTheDocument();
    expect(screen.getAllByText(/1,000,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/250,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('415').length).toBeGreaterThan(0);
  });

  it('says the factory runs no savings scheme when the report is not served', async () => {
    server.use(
      http.get('*/admin/reports/savingsHeld', () =>
        HttpResponse.json({ code: 'not-found', message: 'No such report' }, { status: 404 }),
      ),
    );
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(<SavingsReport />);
    expect(await screen.findByText(/does not run a savings scheme/i)).toBeInTheDocument();
  });
});
