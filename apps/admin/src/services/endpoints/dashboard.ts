/**
 * M1 Dashboard — the day at a glance.
 *
 * **One request, not one per queue.** The alternative — fanning out to five list
 * endpoints with `pageSize=1` and reading totals — works, but it puts five round
 * trips and five database counts behind the first screen every clerk opens, on a
 * connection shared with the phones. The server can answer this from indexes.
 *
 * The alerts are server-composed for the same reason the eligibility payloads
 * carry their own working: the rule that makes something an alert is policy, and
 * a console that invented its own thresholds would disagree with the reports.
 */

import type { DashboardSummary } from '@tfd/domain';
import { apiClient } from '../api/client';

export const dashboardEndpoints = {
  get: () =>
    apiClient.get<DashboardSummary>('/admin/dashboard').then((response) => response.data),
};
