/**
 * The composer's Kind list comes from the kinds the factory offers (`push.categories`),
 * not from the automatic-trigger rows, which no seed creates. With neither, it says why.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { mockConfigs } from '@/services/mocks/seed';
import { ComposeDialog } from '@/modules/notifications/ComposeDialog';
import { notificationRepository } from '@/services/repositories/notificationRepository';
import { renderWithProviders, signInAs, signOut } from './render';

function serveConfig(push: unknown) {
  const real = Object.values(mockConfigs)[0]!;
  server.use(http.get('*/config', () => HttpResponse.json({ ...real, push })));
}

describe('the composer’s Kind list', () => {
  beforeEach(async () => {
    signOut();
    await signInAs('factoryadmin@galabodatea.lk');
  });

  it('lists the kinds the factory offers, though no trigger rows exist', async () => {
    serveConfig({ categories: ['newsArticle', 'billPublished'], defaultCategories: [] });
    renderWithProviders(<ComposeDialog open onClose={() => {}} triggers={[]} />);

    await userEvent.click(await screen.findByRole('combobox', { name: 'Kind' }));
    const names = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(names).toEqual(expect.arrayContaining(['Account published', 'News article']));
  });

  it('says push is not set up, with the way to fix it, instead of an empty list', async () => {
    serveConfig(null);
    renderWithProviders(<ComposeDialog open onClose={() => {}} triggers={[]} />);

    expect(await screen.findByText(/not set up for this factory/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Configuration → Notifications/ })).toHaveAttribute(
      'href',
      '/configuration?section=push',
    );
  });

  /**
   * The API takes `all` or `suppliers` with ids, and the copy as `translations`. Sent in the
   * console's own shape (`collectionPoint`, flat `title` / `body`) every send was refused.
   */
  it('sends a collection point as its suppliers’ ids, and the copy as translations', async () => {
    let sent: {
      audience?: { kind: string; supplierIds?: string[] };
      translations?: unknown;
    } | null = null;
    server.use(
      http.post('*/admin/notifications', async ({ request }) => {
        sent = (await request.json()) as typeof sent;
        return HttpResponse.json({
          id: 'ntf-1',
          status: 'sent',
          targetedSuppliers: 1,
          reachableDevices: 1,
          suppressedDevices: 0,
          suppliersWithoutDevice: 0,
        });
      }),
    );

    await notificationRepository.send({
      category: 'newsArticle',
      title: 'Collection moves to 7am',
      body: 'From Monday.',
      audience: {
        kind: 'collectionPoint',
        collectionPoint: 'MAKADURA',
        collectionPointId: 'cp-makadura',
      },
    });

    expect(sent!.audience!.kind).toBe('suppliers');
    expect(sent!.audience!.supplierIds!.length).toBeGreaterThan(0);
    expect(sent!.translations).toEqual([
      { lang: 'en', title: 'Collection moves to 7am', body: 'From Monday.' },
    ]);
  });

  it('sends "all suppliers" as the API’s `all`', async () => {
    let audience: unknown = null;
    server.use(
      http.post('*/admin/notifications/reach', async ({ request }) => {
        audience = ((await request.json()) as { audience: unknown }).audience;
        return HttpResponse.json({
          targetedSuppliers: 0,
          reachableDevices: 0,
          suppressedDevices: 0,
          suppliersWithoutDevice: 0,
        });
      }),
    );

    await notificationRepository.reach('newsArticle', { kind: 'allSuppliers' });
    expect(audience).toEqual({ kind: 'all' });
  });
});
