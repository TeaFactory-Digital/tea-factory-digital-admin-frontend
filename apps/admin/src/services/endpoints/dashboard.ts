/**
 * M1 Dashboard: the day at a glance.
 *
 * **One request, not one per queue.** The alternative (fanning out to five list
 * endpoints with `pageSize=1` and reading totals) works, but it puts five round
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
 * **Effectively `DashboardSummary` now: G-12 and G-12a are both closed.** `queues` is a
 * real `QueueCount[]` carrying the age of the oldest item, `app` reports v2's headline
 * adoption figures, and `content` is the four silent failures `ContentHealth` describes
 * rather than two published counts.
 *
 * What G-12a was, because the shape of this interface is the record of it:
 *
 *  - **The endpoint answered `500` for any factory that had ever had a change request.**
 *    `adoptionTrend` selected `count(*) AS total`, Prisma hands a Postgres `bigint` back
 *    as a JavaScript `BigInt`, and `JSON.stringify` throws on one, so Express answered a
 *    bare `500` with no domain code, from the serializer rather than from a handler. It
 *    was **data-dependent**: empty table, `200`; three rows, `500`. It therefore passed on
 *    every fresh machine and in CI, and would have fired on this console's landing page
 *    the first morning a supplier filed anything. `total` is gone, nothing having read
 *    it, and a `BigInt` replacer now nets the whole class of it server-side.
 *  - **The trends were raw SQL rows** (`month_key`, `app_share`, `kgs`) where the rest
 *    of the API is camel-cased. They are mapped server-side now, so this console no longer
 *    translates snake_case that leaked out of a raw query.
 *
 * `cycle` and `today` are absent and that is fine: v2's dashboard does not render them.
 *
 * `sync` rides here on purpose rather than on an endpoint of its own: the API has no
 * `GET /admin/factory-sync` and says so (ADR-005, Q18). A resolved decision, not a gap.
 */
export interface ServedDashboard {
  queues: QueueCount[];
  app: AppAdoption;
  content: ContentHealth;
  /** `appShare` is a **percentage**, 0 to 100, unlike `app.appRequestShare` (a fraction). */
  adoptionTrend: Array<{ monthKey: string; appShare: number | null }>;
  /** `totalKgs` is a `number`: the server casts the `SUM` to text and parses it. */
  intakeTrend: Array<{ monthKey: string; totalKgs: number }>;
  sync: FactorySyncStatus | null;
  alerts: Array<{ key?: string; id?: string; severity?: DashboardAlert['severity']; params?: Record<string, string | number> }>;
}

export const dashboardEndpoints = {
  get: () =>
    apiClient.get<ServedDashboard>('/admin/dashboard').then((response) => response.data),
};
