/**
 * M16 Reports.
 *
 * Two endpoints, and the shape of them is the module's one design decision: **a report is
 * asked for and answered, never stored.** There is no create, no save and no schedule — a
 * stored result is a second answer waiting to disagree with the records it came from, which is
 * the same argument that keeps a bill a read model over deliveries and a rate rather than a
 * table somebody writes.
 *
 * `run` returns its **columns with the rows**, so one screen renders any report. That is not
 * laziness: the API is the only thing that knows whether a number is money, kilos or a count,
 * and a grid that guessed would print `LKR 412.00` over a supplier count.
 *
 * **What is not here: an export.** §18.1 asks for CSV/XLSX and status.md records its absence
 * for M17 as well — the same decision, for the same reason. A disabled download button is
 * worse than an absent one.
 */

import type { ReportCatalogue, ReportId, ReportResult, ReportRunParams } from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const reportEndpoints = {
  /**
   * The reports this factory can run, and the months they can be run over.
   *
   * Served rather than hardcoded in the console, because which reports exist is a property of
   * the data warehouse behind them (§19.1) — and when that lands, the list grows without a
   * console release.
   *
   * The months come from here rather than from M5's `GET /admin/bill-months` because §12.1
   * gives the factory administrator `reports: R` and `billing: none` — see `ReportCatalogue`.
   */
  list: () => apiClient.get<ReportCatalogue>('/admin/reports').then((response) => response.data),

  /** `422 invalid` when a required parameter is missing — see `missingReportParams`. */
  run: (id: ReportId, params: ReportRunParams) =>
    apiClient
      .get<ReportResult>(`/admin/reports/${id}`, { params: toParams(params) })
      .then((response) => response.data),
};
