import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { CreditReport } from '@/modules/reports/CreditReport';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('the credit and tea packets report', () => {
  it('totals what was given in the period', async () => {
    server.use(
      http.get('*/admin/reports/creditGiven', () =>
        HttpResponse.json({
          rows: [
            {
              monthKey: '2026-08',
              advanceAmount: 100000,
              advanceCount: 10,
              loanAmount: 0,
              loanCount: 0,
              manureAmount: 49000,
              manureCount: 5,
              teaPacketAmount: 6000,
              teaPackets: 12,
              rejected: 2,
            },
            {
              monthKey: '2026-09',
              advanceAmount: 50000,
              advanceCount: 5,
              loanAmount: 300000,
              loanCount: 2,
              manureAmount: 0,
              manureCount: 0,
              teaPacketAmount: 3000,
              teaPackets: 6,
              rejected: 1,
            },
          ],
        }),
      ),
    );
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(<CreditReport />);
    expect((await screen.findAllByText(/150,000/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/300,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/3 requests rejected/)).toBeInTheDocument();
  });

  it('says the report is not available yet while the API does not serve it', async () => {
    server.use(
      http.get('*/admin/reports/creditGiven', () =>
        HttpResponse.json({ code: 'not-found', message: 'No such report' }, { status: 404 }),
      ),
    );
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(<CreditReport />);
    expect(await screen.findByText(/not available on this server/i)).toBeInTheDocument();
  });
});
