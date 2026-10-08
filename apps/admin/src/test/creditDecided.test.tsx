/**
 * A decided credit request must still open.
 *
 * The server keeps an eligibility snapshot only when a request is **approved**. A
 * rejection lends nothing and a cancellation was never decided, so both come back with
 * `eligibility: null`. The detail screen and the queue both read `eligibility.available`
 * unguarded, so every rejected or cancelled request crashed into the route's error
 * boundary ("This screen could not be shown"). The mock always computed eligibility,
 * which is why nothing caught it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import type { AdminCreditRequest } from '@tfd/domain';
import { server } from '@/services/mocks/server';
import { creditRepository } from '@/services/repositories/creditRepository';
import { CreditRequestDetailScreen } from '@/modules/credit/CreditRequestDetailScreen';
import { CreditScreen } from '@/modules/credit/CreditScreen';
import { en } from '@/i18n/locales/en';
import { renderWithProviders, signInAs, signOut } from './render';

const MANAGER = 'manager@galabodatea.lk';

/** A real fixture, rejected the way the API serves it: no figures. */
async function rejectedWithoutFigures(): Promise<AdminCreditRequest> {
  const pending = await creditRepository.get('crd-1');
  return { ...pending, status: 'rejected', eligibility: null };
}

beforeEach(async () => {
  signOut();
  await signInAs(MANAGER);
});

describe('a credit request with no eligibility', () => {
  it('opens its detail screen and says why there are no figures', async () => {
    const request = await rejectedWithoutFigures();
    server.use(http.get('*/admin/credit-requests/:id', () => HttpResponse.json(request)));

    renderWithProviders(
      <Routes>
        <Route path="/credit/:id" element={<CreditRequestDetailScreen />} />
      </Routes>,
      { route: `/credit/${request.id}` },
    );

    expect(await screen.findByText(en['credit.detail.noEligibility'])).toBeInTheDocument();
    // Nothing to decide on a rejected request.
    expect(screen.queryByRole('button', { name: en['credit.reject'] })).not.toBeInTheDocument();
  });

  it('lists in the queue with a dash where the headroom would be', async () => {
    const request = await rejectedWithoutFigures();
    server.use(
      http.get('*/admin/credit-requests', () =>
        HttpResponse.json({ items: [request], total: 1, page: 0, pageSize: 25 }),
      ),
    );

    renderWithProviders(<CreditScreen />, { route: '/credit?status=rejected' });

    expect(await screen.findByText(request.supplierName)).toBeInTheDocument();
  });
});
