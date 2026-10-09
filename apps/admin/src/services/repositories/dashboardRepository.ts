/**
 * M1 Dashboard gateway.
 *
 * This was the widest gap between what the API sent and what the screen was written
 * against (gap **G-12**), and it is now closed, along with the `500` its rebuild
 * introduced (**G-12a**): `queues` arrives as real `QueueCount` records with the age of
 * the oldest item, `app` reports v2's headline adoption figures, `content` is
 * `ContentHealth` rather than two published counts, and the trends arrive camel-cased.
 * The three `null`-guarded view fields this file used to carry are gone with it.
 *
 * The rule it still follows: **an absence is rendered as an absence.** Where the payload
 * has no answer the view carries `null` and the screen says so, because defaulting to `0`
 * is the failure the dashboard exists to prevent: *"an empty inbox and an inbox that
 * cannot exist look identical on screen"*.
 */

import type { DashboardAlert } from '@tfd/domain';
import { dashboardEndpoints, type ServedDashboard } from '../endpoints/dashboard';

/**
 * The dashboard as this console renders it.
 *
 * Still not `DashboardSummary`: that type also carries `cycle` and `today`, which v2's
 * screen does not render and the API does not send. Naming the subset keeps the
 * repository from having to invent two objects nothing reads.
 */
export interface DashboardView {
  queues: ServedDashboard['queues'];
  app: ServedDashboard['app'];
  content: ServedDashboard['content'];
  adoptionTrend: Array<{ monthKey: string; appShare: number | null }>;
  alerts: DashboardAlert[];
  /**
   * How fresh the replicated figures are. Rides on this payload by design (ADR-005, Q18)
   * rather than on an endpoint of its own, and `null` means the factory has no sync
   * configured, which the console renders as no freshness caption at all, not as "stale".
   */
  sync: ServedDashboard['sync'];
}

/**
 * The series the chart reads, oldest first.
 *
 * **No longer a rename** (**G-12a** closed). This used to map `month_key` → `monthKey`
 * and `app_share` → `appShare`, because both leaked out of a raw query in snake_case
 * while the rest of the API is camel. The server maps them now, and it also dropped the
 * `total` this function deliberately ignored: a `count(*)`, which is a Postgres `bigint`,
 * which `JSON.stringify` refuses, which made the whole endpoint answer `500` as soon as
 * the factory had a single change request.
 *
 * The sort stays. It is asserted rather than assumed: the API orders ascending today, and
 * a chart that silently drew backwards would look like a collapse rather than like a bug.
 *
 * **And `appShare` is divided by 100.** The API sends it as a percentage (`100` for every
 * request from the app, `round(100.0 * …, 1)` in the query), while `app.appRequestShare`
 * on the same payload is a fraction, and the chart and `formatPercent` read fractions.
 * Unconverted, a month of 100% plotted at 10,000%. `null` stays `null`: a month with no
 * requests has no share, which is not 0%.
 */
function toAdoptionTrend(rows: ServedDashboard['adoptionTrend']) {
  return [...rows]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((row) => ({
      monthKey: row.monthKey,
      appShare: row.appShare === null ? null : row.appShare / 100,
    }));
}

/**
 * Server-composed alerts, normalised.
 *
 * The API sends `{ key, params }` and the console's `DashboardAlert` wants
 * `{ id, severity, messageKey, params }`. The list is empty today, so this is the shape
 * agreed for when it is not, and `severity` defaults to `info` rather than `warning`,
 * because an alert that shouts by default trains the office to ignore the ones that mean
 * it.
 */
function toAlerts(rows: ServedDashboard['alerts']): DashboardAlert[] {
  return rows.flatMap((row, index) => {
    const messageKey = row.key;
    if (!messageKey) return [];
    return [
      {
        id: row.id ?? `${messageKey}:${index}`,
        severity: row.severity ?? 'info',
        messageKey,
        params: row.params,
      },
    ];
  });
}

export const dashboardRepository = {
  get: async (): Promise<DashboardView> => {
    const served = await dashboardEndpoints.get();

    return {
      queues: served.queues ?? [],
      app: served.app,
      content: served.content,
      adoptionTrend: toAdoptionTrend(served.adoptionTrend ?? []),
      alerts: toAlerts(served.alerts ?? []),
      sync: served.sync ?? null,
    };
  },
};
