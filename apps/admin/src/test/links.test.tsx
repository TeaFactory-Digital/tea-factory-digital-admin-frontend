/**
 * Counts and warnings that say where their records are (27 November 2026): "Open requests: 3"
 * goes to them, an alert opens what it is about, a tea packet in the bell opens that supplier's
 * tea packets. Each of these used to be text that could not be clicked, or a link to nowhere.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, within } from '@testing-library/react';
import { SupplierDetailScreen } from '@/modules/suppliers/SupplierDetailScreen';
import { ChangeRequestsScreen } from '@/modules/change-requests/ChangeRequestsScreen';
import userEvent from '@testing-library/user-event';
import { dashboardRepository } from '@/services/repositories/dashboardRepository';
import { activityPath } from '@/layout/activityText';
import { mockChangeRequests, mockSuppliers, toSupplierDetail } from '@/services/mocks/seed';
import { server } from '@/services/mocks/server';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => {
  signOut();
});

describe('dashboard alerts', () => {
  it('open what they are about, even when the server sends no link', async () => {
    await signInAs('manager@galabodatea.lk');
    const { alerts } = await dashboardRepository.get();
    const href = (key: string) => alerts.find((alert) => alert.messageKey === key)?.href;

    expect(href('dashboard.alert.missingBankDetails')).toBe('/suppliers?hasBankDetails=false');
    // The seed sends this one without a link: the console works it out from the month.
    expect(href('dashboard.alert.awaitingRate')).toMatch(/^\/rates\?month=\d{4}-\d{2}$/);
  });
});

describe('the bell', () => {
  it('opens a tea packet in that supplier\'s tea packets, in the status the event left it', () => {
    const item = { kind: 'teaPacket.cancelled', supplierId: 'sup-7', entityId: 'tp-1' } as Parameters<
      typeof activityPath
    >[0];
    expect(activityPath(item)).toBe('/tea-packets?supplierId=sup-7&status=cancelled');
  });
});

describe('a supplier with open requests', () => {
  it('names the queues they are in, each a link filtered to this supplier', async () => {
    const pending = mockChangeRequests.find((request) => request.status === 'pending')!;
    const supplier = mockSuppliers.find((one) => one.id === pending.supplierId)!;
    await signInAs('manager@galabodatea.lk');
    // The live API sends the count on the detail; the fixture's detail leaves it out.
    server.use(
      http.get('*/admin/suppliers/:id', ({ params }) =>
        params.id === supplier.id
          ? HttpResponse.json({ ...toSupplierDetail(supplier), pendingRequests: 2 })
          : undefined,
      ),
    );
    renderWithProviders(
      <Routes>
        <Route path="/suppliers/:id" element={<SupplierDetailScreen />} />
      </Routes>,
      { route: `/suppliers/${supplier.id}` },
    );

    const open = await screen.findByRole('region', { name: 'Open requests' });
    const link = await within(open).findByRole('link', { name: /change requests/i });
    expect(link).toHaveAttribute('href', `/change-requests?supplierId=${supplier.id}`);
  });
});

describe('a queue opened for one supplier', () => {
  it('says so, names the supplier, and shows everyone again from the cross', async () => {
    const pending = mockChangeRequests.find((request) => request.status === 'pending')!;
    const supplier = mockSuppliers.find((one) => one.id === pending.supplierId)!;
    await signInAs('manager@galabodatea.lk');
    renderWithProviders(<ChangeRequestsScreen />, { route: `/change-requests?supplierId=${supplier.id}` });

    const clear = await screen.findByRole('button', { name: 'Show every supplier' });
    const chip = clear.closest<HTMLElement>('[role="status"]')!;
    expect(await within(chip).findByText(`${supplier.supplierCode} · ${supplier.name}`)).toBeInTheDocument();

    await userEvent.click(clear);
    expect(screen.queryByRole('button', { name: 'Show every supplier' })).not.toBeInTheDocument();
  });
});
