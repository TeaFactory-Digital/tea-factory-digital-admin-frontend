/**
 * M1 Dashboard gateway.
 *
 * The one guarantee added here: `intakeTrend` is sorted oldest-first. Charts read
 * left to right, and the same invariant already binds the app's income summaries
 * (operations.md). If the API sorts differently the console still works, but
 * every render re-sorts for nothing — so it is asserted once, here.
 */

import type { DashboardSummary } from '@tfd/domain';
import { dashboardEndpoints } from '../endpoints/dashboard';

export const dashboardRepository = {
  get: async (): Promise<DashboardSummary> => {
    const summary = await dashboardEndpoints.get();
    return {
      ...summary,
      intakeTrend: [...summary.intakeTrend].sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
};
