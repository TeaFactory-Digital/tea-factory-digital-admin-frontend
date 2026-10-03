/**
 * `GET /admin/dashboard` as the API actually sends it, read through the repository.
 *
 * The payload below is a real response from a staging factory. The case that matters is
 * the trend: the API sends `appShare` as a percentage while the chart reads fractions.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { dashboardRepository } from '@/services/repositories/dashboardRepository';
import { signInAs, signOut } from './render';

const SERVED = {
  queues: [
    {
      queue: 'changeRequests',
      pending: 3,
      oldestPendingAt: '2026-09-19T14:38:39.765Z',
      breachingSla: 3,
    },
  ],
  app: { suppliersWithApp: 1, totalSuppliers: 1, devicesRegistered: 2, appRequestShare: null },
  content: { articlesWithGaps: 1, bannersLive: 1, bannersExpired: 0, staticPagesUnwritten: 0 },
  adoptionTrend: [
    { monthKey: '2026-09', appShare: 100 },
    { monthKey: '2026-08', appShare: 37.5 },
    { monthKey: '2026-07', appShare: null },
  ],
  intakeTrend: [],
  sync: null,
  alerts: [],
};

describe('the dashboard repository', () => {
  beforeEach(async () => {
    signOut();
    await signInAs('clerk@galabodatea.lk');
    server.use(http.get('*/admin/dashboard', () => HttpResponse.json(SERVED)));
  });

  it('reads the trend percentage as a fraction, oldest first, keeping null as null', async () => {
    const view = await dashboardRepository.get();

    // 100 from the API is every request from the app: 1, not 100 (which drew 10,000%).
    expect(view.adoptionTrend).toEqual([
      { monthKey: '2026-07', appShare: null },
      { monthKey: '2026-08', appShare: 0.375 },
      { monthKey: '2026-09', appShare: 1 },
    ]);
  });

  it('leaves the fields that are already fractions alone', async () => {
    const view = await dashboardRepository.get();
    expect(view.app.appRequestShare).toBeNull();
    expect(view.sync).toBeNull();
  });
});
