/**
 * The suppliers list against `GET /admin/suppliers` as it is sent today: eight fields,
 * the collection point as an object, and none of the six columns the API does not fill.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { SuppliersScreen } from '@/modules/suppliers/SuppliersScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const ROW = {
  id: '78830bab-c0e2-416d-b377-0cdc5930aeff',
  supplierCode: '5708',
  name: 'Seeded Supplier',
  division: null,
  status: 'active',
  collectionPoint: null,
  hasBankDetails: false,
  hasApp: true,
};

let lastUrl: URL | null = null;

describe('the suppliers list', () => {
  beforeEach(async () => {
    signOut();
    await signInAs('factoryadmin@galabodatea.lk');
    lastUrl = null;
    server.use(
      http.get('*/admin/suppliers', ({ request }) => {
        lastUrl = new URL(request.url);
        return HttpResponse.json({ items: [ROW], total: 1, page: 0, pageSize: 50, nextPage: null });
      }),
    );
  });

  it('hides the columns the API does not send, rather than filling them with placeholders', async () => {
    renderWithProviders(<SuppliersScreen />, { route: '/suppliers' });

    expect(await screen.findByText('Seeded Supplier')).toBeInTheDocument();
    for (const header of ['NIC', 'Savings /kg', 'Last delivery', 'Pending']) {
      expect(screen.queryByRole('columnheader', { name: header })).not.toBeInTheDocument();
    }
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('No bank details')).toBeInTheDocument();
    expect(screen.queryByText(/suppliers\.payment\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not available/)).not.toBeInTheDocument();
  });

  it('filters by collection point id, the parameter the API reads', async () => {
    renderWithProviders(<SuppliersScreen />, { route: '/suppliers?collectionPointId=cp-makadura' });

    await screen.findByText('Seeded Supplier');
    expect(lastUrl?.searchParams.get('collectionPointId')).toBe('cp-makadura');
    expect(lastUrl?.searchParams.has('collectionPoint')).toBe(false);
  });
});
