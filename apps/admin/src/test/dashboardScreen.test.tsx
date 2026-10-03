/**
 * The dashboard rendered from a real staging response: one queue with everything past
 * target, five empty ones, one month of trend and no requests this month.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { DashboardScreen } from '@/modules/dashboard/DashboardScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const empty = (queue: string) => ({ queue, pending: 0, oldestPendingAt: null, breachingSla: 0 });

const SERVED = {
  queues: [
    {
      queue: 'changeRequests',
      pending: 3,
      oldestPendingAt: '2026-09-19T14:38:39.765Z',
      breachingSla: 3,
    },
    empty('inquiries'),
    empty('advanceRequests'),
    empty('loanRequests'),
    empty('manureRequests'),
    empty('teaPacketRequests'),
  ],
  app: { suppliersWithApp: 1, totalSuppliers: 1, devicesRegistered: 2, appRequestShare: null },
  content: { articlesWithGaps: 1, bannersLive: 1, bannersExpired: 0, staticPagesUnwritten: 0 },
  adoptionTrend: [{ monthKey: '2026-09', appShare: 100 }],
  intakeTrend: [],
  sync: null,
  alerts: [],
};

describe('the dashboard', () => {
  beforeEach(async () => {
    signOut();
    await signInAs('factoryadmin@galabodatea.lk');
    server.use(http.get('*/admin/dashboard', () => HttpResponse.json(SERVED)));
  });

  it('gives the waiting queue a card and folds the empty ones into one line', async () => {
    renderWithProviders(<DashboardScreen />);

    const card = (await screen.findByText('3 past target')).closest('a');
    expect(card).toHaveClass('border-error');
    expect(screen.getByText('Nothing waiting:')).toBeInTheDocument();
    // Empty queues are named once, as chips, not as five cards reading 0.
    expect(screen.getAllByText('Loans')).toHaveLength(1);
    expect(screen.queryByText('Nothing waiting')).not.toBeInTheDocument();
  });

  it('says what one month of trend and a month without requests mean, in words', async () => {
    renderWithProviders(<DashboardScreen />);

    expect(await screen.findByText(/Only September 2026 so far/)).toBeInTheDocument();
    // Once on the adoption card (1 of 1 installed) and once as the month's share.
    expect(screen.getAllByText('100%')).toHaveLength(2);
    expect(screen.getByText('No requests raised yet this month.')).toBeInTheDocument();
  });
});
