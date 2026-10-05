/**
 * A supplier's requests history, read from the credit and tea packet queues. The API
 * ignored `supplierId` (BACKEND-TODO #28), so the history also filters by supplier itself.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { Route, Routes } from 'react-router-dom';
import { SupplierRequestHistory } from '@/modules/suppliers/SupplierRequestHistory';
import { SupplierDetailScreen } from '@/modules/suppliers/SupplierDetailScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const page = (items: unknown[]) => ({
  items,
  page: 0,
  pageSize: 100,
  total: items.length,
  nextPage: null,
});
const credit = (
  id: string,
  supplierId: string,
  facility: string,
  status: string,
  amount: number,
) => ({
  id,
  supplierId,
  facility,
  status,
  amount,
  supplierCode: 'X',
  supplierName: 'X',
  reason: null,
  manureType: null,
  quantityKg: null,
  repaymentMonths: null,
  createdAt: `2026-09-0${id.length}T08:00:00.000Z`,
  channel: 'app',
  createdById: null,
  createdByName: null,
  decision: null,
  ageHours: 1,
});

beforeEach(() => signOut());

describe('the requests history', () => {
  it('shows only this supplier, even when the API returns everyone', async () => {
    server.use(
      http.get('*/admin/credit-requests', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        if (status === 'approved') {
          return HttpResponse.json(
            page([
              credit('c1', 'sup-1', 'advance', 'approved', 5000),
              credit('c22', 'sup-OTHER', 'loan', 'approved', 90000),
            ]),
          );
        }
        if (status === 'rejected')
          return HttpResponse.json(page([credit('c333', 'sup-1', 'loan', 'rejected', 20000)]));
        return HttpResponse.json(page([]));
      }),
      http.get('*/admin/tea-packet-requests', () => HttpResponse.json(page([]))),
    );
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<SupplierRequestHistory supplierId="sup-1" />);

    const table = await screen.findByRole('table');
    // Two rows of this supplier's; the other supplier's 90,000 loan is not there.
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByText(/90,000/)).not.toBeInTheDocument();
    // Totals count approved only: the rejected loan does not add to "Loans".
    expect(screen.getByRole('button', { name: /advances/i })).toHaveTextContent('5,000');
    expect(screen.getByRole('button', { name: /loans/i })).toHaveTextContent('0.00');
  });
});

describe('who sees the Requests tab', () => {
  const renderDetail = () =>
    renderWithProviders(
      <Routes>
        <Route path="/suppliers/:id" element={<SupplierDetailScreen />} />
      </Routes>,
      { route: '/suppliers/sup-1' },
    );

  it('is offered to a clerk, who can read the queues', async () => {
    await signInAs('clerk@galabodatea.lk');
    renderDetail();
    expect(await screen.findByRole('tab', { name: /requests/i })).toBeInTheDocument();
  });

  it('is not offered to a factory administrator, whom the queues refuse', async () => {
    await signInAs('factoryadmin@galabodatea.lk');
    renderDetail();
    expect(await screen.findByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /requests/i })).not.toBeInTheDocument();
  });
});
