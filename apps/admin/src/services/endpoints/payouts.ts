/**
 * M6 Payouts — preparing, releasing and reconciling money that leaves the factory.
 *
 * **The file (§21.17) is here now, and the shape of it is the interesting part.** The
 * question the factory has not answered is *"what format does your bank accept?"* — SLIPS,
 * CEFTS, or its own bulk-upload sheet — and the wrong answer was three coded serialisers
 * behind a dropdown, two of whose layouts would be invented. So what a factory configures
 * in M14 is the **layout** (`payoutExport.ts`), and a format's name becomes a preset
 * somebody completes once their bank confirms it. `file` below serialises a run through
 * that template.
 *
 * What is still open, and still stated on the screen: a **fixed-width** format with control
 * totals, and **cheques on pre-printed stock**. Neither is a column order, so neither is
 * something this template can honestly claim to produce.
 *
 * The three writes map onto three different people:
 *
 *  - `create` is the accountant's (`payouts: W`) — preparing the run.
 *  - `approve` is the manager's (`payouts: A`) — releasing it, and refused if they
 *    prepared it themselves (BR-501).
 *  - `mark` is whoever is sitting with the bank's response — reconciliation, which
 *    is the half of a payout that every system forgets and every office does by hand.
 */

import type {
  Paged,
  PaymentMethod,
  PayoutLine,
  PayoutLineMark,
  PayoutLineQuery,
  PayoutRun,
  PayoutRunQuery,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

/**
 * The name the browser should save the file under, read from the response.
 *
 * The server names it, not the console: the month and the method are what an office files
 * a payment run by, and two consoles guessing at the convention would produce two naming
 * schemes in one shared folder. Falls back only if the header is missing.
 */
function filenameFrom(disposition: unknown): string {
  const match = typeof disposition === 'string' ? /filename="?([^"]+)"?/.exec(disposition) : null;
  return match?.[1] ?? 'payout.csv';
}

export const payoutEndpoints = {
  list: (query: PayoutRunQuery = {}) =>
    apiClient
      .get<Paged<PayoutRun>>('/admin/payout-runs', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient.get<PayoutRun>(`/admin/payout-runs/${id}`).then((response) => response.data),

  lines: (id: string, query: PayoutLineQuery = {}) =>
    apiClient
      .get<Paged<PayoutLine>>(`/admin/payout-runs/${id}/lines`, { params: toParams(query) })
      .then((response) => response.data),

  /**
   * Prepare a run for one month and one method.
   *
   * `409 month-not-published` is the refusal that matters: a run against an open
   * month pays against figures that can still change, and money that has left the
   * factory cannot be re-derived. Also `409 run-exists`, `409 bills-missing`, and
   * `409 no-payable-lines` when nobody on that method is owed anything.
   */
  create: (monthKey: string, method: PaymentMethod) =>
    apiClient
      .post<PayoutRun>('/admin/payout-runs', { monthKey, method })
      .then((response) => response.data),

  /** `409 already-approved` · `409 four-eyes-violation` · `409 no-payable-lines`. */
  approve: (id: string, note?: string) =>
    apiClient
      .post<PayoutRun>(`/admin/payout-runs/${id}/approve`, { note })
      .then((response) => response.data),

  /**
   * The run as a delimited file, shaped by the tenant's template.
   *
   * `responseType: 'text'` because this is the one endpoint that does not answer JSON, and
   * axios would otherwise try to parse a CSV whose first field happens to look numeric.
   *
   * `409 run-not-approved` for a draft — a file generated before the four-eyes release and
   * uploaded to the bank walks straight around BR-501. `409 export-template-invalid` when
   * the configured layout could not produce a usable file.
   */
  file: (id: string) =>
    apiClient
      .get<string>(`/admin/payout-runs/${id}/file`, { responseType: 'text' })
      .then((response) => ({
        body: response.data,
        filename: filenameFrom(response.headers['content-disposition']),
      })),

  /**
   * What the bank or the counter actually did.
   *
   * `409 run-not-approved` before a release · `409 line-not-payable` for a held or
   * already-paid line · `422 note-required` for a failure with no reason.
   */
  mark: (id: string, lineId: string, body: PayoutLineMark) =>
    apiClient
      .post<PayoutLine>(`/admin/payout-runs/${id}/lines/${lineId}/mark`, body)
      .then((response) => response.data),
};
