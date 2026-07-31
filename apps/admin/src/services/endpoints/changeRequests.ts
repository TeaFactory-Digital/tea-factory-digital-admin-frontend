/**
 * M9 Change requests — payout and savings-rate approvals.
 *
 * The module that closes the app's loudest open loop: every `pending` in the
 * supplier's app is this queue, and AC-02 requires that approving here changes
 * the app's displayed value on next refresh while rejecting leaves it untouched
 * and shows the note.
 *
 * Approve and reject share a body because they share a requirement: **rejecting
 * any request without a note is impossible** (AC-06), and approving without one
 * is nearly as bad — the note is what an auditor reads six months later.
 */

import type { AdminChangeRequest, ChangeRequestQuery, DecisionBody, Paged } from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const changeRequestEndpoints = {
  list: (query: ChangeRequestQuery) =>
    apiClient
      .get<Paged<AdminChangeRequest>>('/admin/change-requests', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient
      .get<AdminChangeRequest>(`/admin/change-requests/${id}`)
      .then((response) => response.data),

  /**
   * `409 four-eyes-violation` when the approver created the record (BR-501), and
   * `409 already-decided` when someone else decided it while this queue was open
   * — two clerks working the same inbox is the normal case, not the edge case.
   *
   * Both are **refusals, not warnings**. A warning that can be clicked through
   * is a control that does not exist.
   */
  approve: (id: string, body: DecisionBody) =>
    apiClient
      .post<AdminChangeRequest>(`/admin/change-requests/${id}/approve`, body)
      .then((response) => response.data),

  reject: (id: string, body: DecisionBody) =>
    apiClient
      .post<AdminChangeRequest>(`/admin/change-requests/${id}/reject`, body)
      .then((response) => response.data),
};
