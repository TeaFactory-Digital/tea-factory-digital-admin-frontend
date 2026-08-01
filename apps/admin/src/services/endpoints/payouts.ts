/**
 * M6 Payouts — preparing, releasing and reconciling money that leaves the factory.
 *
 * **What is deliberately not here: the payout file.** §21.17 — SLIPS, CEFTS or a
 * bank-specific CSV, and whether cheques print on pre-printed stock — is unanswered,
 * and a serialiser written against a guessed format is a serialiser that gets thrown
 * away. What the office needs whatever the answer turns out to be is this: which
 * suppliers, how much each, by which method, which of them cannot be paid, who
 * released it, and what the bank actually did. That is a record, not a file format,
 * so it is built now and the export lands on top of it later.
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
