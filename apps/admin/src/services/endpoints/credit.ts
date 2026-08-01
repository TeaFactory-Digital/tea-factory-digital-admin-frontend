/**
 * M7 Credit queues — advances, loans and manure on credit.
 *
 * One set of endpoints for three facilities, because the office does one job with
 * them: read a request, read what the supplier may draw, decide. They differ only
 * in how the ceiling is priced, and that difference lives in `@tfd/domain`.
 *
 * The load-bearing property of these payloads is AC-05: `eligibility` on a row
 * must be **byte-for-byte** what `GET /advances|loans|manure/eligibility` told the
 * supplier's app, including the working. The server derives both from
 * `buildCreditEligibility`; if the console ever re-derived it here instead, the two
 * would agree until the first rounding change and then quietly stop.
 */

import type {
  AdminCreditRequest,
  CreditDecisionBody,
  CreditRequestQuery,
  Paged,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const creditEndpoints = {
  list: (query: CreditRequestQuery) =>
    apiClient
      .get<Paged<AdminCreditRequest>>('/admin/credit-requests', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient
      .get<AdminCreditRequest>(`/admin/credit-requests/${id}`)
      .then((response) => response.data),

  /**
   * Four refusals, and every one of them moves money if it is missed:
   *
   *  - `409 four-eyes-violation` — the approver raised it (BR-501)
   *  - `409 already-decided` — somebody else worked the same inbox
   *  - `409 stale-eligibility` — the ceiling moved under the screen (BR-310)
   *  - `409 over-ceiling` — the amount was never inside the ceiling
   *  - `422 note-required` — a decision nobody can reconstruct (AC-06)
   *
   * `ceilingSeen` travels in the body for the third of those. It is the figure the
   * approver had on screen, and the server compares rather than trusts it.
   */
  approve: (id: string, body: CreditDecisionBody) =>
    apiClient
      .post<AdminCreditRequest>(`/admin/credit-requests/${id}/approve`, body)
      .then((response) => response.data),

  /**
   * Rejecting is **not** gated on fresh eligibility.
   *
   * A rejection lends nothing, and refusing one because the ceiling moved would
   * trap the request: the figures shift again while the clerk reloads, and the row
   * can never be cleared. The ceiling still travels, because a rejection recorded
   * against the numbers it was made on is the better audit entry.
   */
  reject: (id: string, body: CreditDecisionBody) =>
    apiClient
      .post<AdminCreditRequest>(`/admin/credit-requests/${id}/reject`, body)
      .then((response) => response.data),
};
