/**
 * Controls a role cannot use are not offered, and calls a role cannot make are not sent.
 * Each case was a `403` in the browser: a button the API refused, or a panel that asked
 * for data it would then hide.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { TeaPacketsScreen } from '@/modules/tea-packets/TeaPacketsScreen';
import { SupplierDetailScreen } from '@/modules/suppliers/SupplierDetailScreen';
import { InquiryDetailScreen } from '@/modules/inquiries/InquiryDetailScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

beforeEach(() => signOut());

describe('tea packets: deciding needs creditRequests approve', () => {
  it('offers Decide to a manager', async () => {
    await signInAs(MANAGER);
    renderWithProviders(<TeaPacketsScreen />, { route: '/tea-packets' });
    expect((await screen.findAllByRole('button', { name: /decide/i })).length).toBeGreaterThan(0);
  });

  it('does not offer it to a clerk, who only reads the queue', async () => {
    await signInAs(CLERK);
    renderWithProviders(<TeaPacketsScreen />, { route: '/tea-packets' });
    await screen.findAllByRole('row');
    expect(screen.queryByRole('button', { name: /decide/i })).not.toBeInTheDocument();
  });
});

describe('the audit trail is not asked for without auditLog', () => {
  it('sends no audit request from a clerk’s inquiry, and the supplier has no Activity tab', async () => {
    let auditCalls = 0;
    server.use(
      http.get('*/admin/audit', () => {
        auditCalls += 1;
        return HttpResponse.json({ items: [], page: 0, pageSize: 50, total: 0, nextPage: null });
      }),
    );
    await signInAs(CLERK);
    renderWithProviders(
      <Routes>
        <Route path="/inquiries/:id" element={<InquiryDetailScreen />} />
        <Route path="/suppliers/:id" element={<SupplierDetailScreen />} />
      </Routes>,
      { route: '/inquiries/inq-1' },
    );
    expect(await screen.findByText('Conversation', { exact: true })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(auditCalls).toBe(0);
  });

  it('hides the supplier Activity tab from a clerk', async () => {
    await signInAs(CLERK);
    renderWithProviders(
      <Routes>
        <Route path="/suppliers/:id" element={<SupplierDetailScreen />} />
      </Routes>,
      { route: '/suppliers/sup-1' },
    );
    expect(await screen.findByRole('tab', { name: /overview/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('tab', { name: /activity/i })).not.toBeInTheDocument(),
    );
  });
});
