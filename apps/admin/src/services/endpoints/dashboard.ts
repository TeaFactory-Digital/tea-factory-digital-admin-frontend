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

import type {
  AppAdoption,
  ContentHealth,
  DashboardAlert,
  FactorySyncStatus,
  QueueCount,
} from '@tfd/domain';
import { apiClient } from '../api/client';

/**
 * What `GET /admin/dashboard` sends.
 *
 * **Almost `DashboardSummary` now — gap G-12 is largely closed.** `queues` is a real
 * `QueueCount[]` carrying the age of the oldest item, `app` reports v2's headline
 * adoption figures, and `content` is the four silent failures `ContentHealth` describes
 * rather than two published counts.
 *
 * Two things still differ, and both are recorded as **G-12a**:
 *
 *  - **The trends are raw SQL rows** — `month_key` / `app_share` / `kgs` — where the rest
 *    of the API is camel-cased. Mapped in the repository.
 *  - **`adoptionTrend` carries a `total` that is a Postgres `bigint`**, which
 *    `JSON.stringify` cannot serialise. The endpoint therefore answers **`500` for any
 *    factory that has ever had a change request**, and `200` only while the table is
 *    empty. The console cannot work around a response it never receives; see
 *    `dashboardRepository` for what it does instead.
 *
 * `cycle` and `today` are absent and that is fine — v2's dashboard does not render them.
 *
 * `sync` rides here on purpose rather than on an endpoint of its own: the API has no
 * `GET /admin/factory-sync` and says so (ADR-005, Q18). A resolved decision, not a gap.
 */
export interface ServedDashboard {
  queues: QueueCount[];
  app: AppAdoption;
  content: ContentHealth;
  adoptionTrend: Array<{ month_key: string; total: number | string; app_share: number | null }>;
  intakeTrend: Array<{ month_key: string; kgs: string }>;
  sync: FactorySyncStatus | null;
  alerts: Array<{ key?: string; id?: string; severity?: DashboardAlert['severity']; params?: Record<string, string | number> }>;
}

export const dashboardEndpoints = {
  get: () =>
    apiClient.get<ServedDashboard>('/admin/dashboard').then((response) => response.data),
};
