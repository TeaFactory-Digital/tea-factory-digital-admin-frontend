/**
 * The supplier record's Notifications tab against `GET /admin/suppliers/:id/notifications`
 * as the API sends it: `sends` rather than `recentSends`, `optedIn` per category, no ids
 * and no titles. Read as the console's own type, it threw and the tab stayed blank.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { SupplierNotificationsPanel } from '@/modules/suppliers/SupplierNotificationsPanel';
import { renderWithProviders, signInAs, signOut } from './render';

const SERVED = {
  hasApp: true,
  devices: [
    {
      platform: 'android',
      categories: ['billPublished'],
      registeredAt: '2026-09-01T08:00:00.000Z',
    },
  ],
  categories: [
    { category: 'billPublished', optedIn: true, reachable: true },
    { category: 'newsArticle', optedIn: false, reachable: false },
  ],
  sends: [
    {
      sendId: 'send-1',
      category: 'billPublished',
      sentAt: '2026-09-30T10:00:00.000Z',
      deliveredToDevices: 1,
      suppressedReason: null,
    },
  ],
};

describe('the supplier Notifications tab', () => {
  beforeEach(async () => {
    signOut();
    await signInAs('factoryadmin@galabodatea.lk');
  });

  it('renders the API’s shape: devices, per-category reach and the sends', async () => {
    server.use(http.get('*/admin/suppliers/:id/notifications', () => HttpResponse.json(SERVED)));
    renderWithProviders(<SupplierNotificationsPanel supplierId="sup-1" />);

    expect(await screen.findByText('sent to 1')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
  });

  it('says the factory does not use push, instead of a blank tab', async () => {
    server.use(
      http.get('*/admin/suppliers/:id/notifications', () =>
        HttpResponse.json({ code: 'feature-disabled', message: 'off' }, { status: 404 }),
      ),
    );
    renderWithProviders(<SupplierNotificationsPanel supplierId="sup-1" />);

    expect(await screen.findByText(/does not send push notifications/)).toBeInTheDocument();
  });
});
