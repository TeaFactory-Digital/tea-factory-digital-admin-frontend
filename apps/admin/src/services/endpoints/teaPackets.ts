/**
 * M18 Tea packet requests — the queue the app has been waiting for.
 *
 * The app has shipped `RequestTeaPacketsScreen` since its first release and v1 of this
 * console had no endpoint to decide one. Every other `pending` in a supplier's app is a
 * queue somewhere; this was the one that was not, so a supplier who asked for tea got
 * silence and the office never saw the request at all.
 *
 * Deliberately **not** under `/admin/credit-requests`. A tea-packet request carries no
 * eligibility, so the shared path would have needed `ceilingSeen` on the body and a
 * `CreditEligibility` on the response that could only ever be filled with nulls.
 */

import type {
  AdminTeaPacketRequest,
  DecisionBody,
  Paged,
  TeaPacketRequestQuery,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const teaPacketEndpoints = {
  list: (query: TeaPacketRequestQuery) =>
    apiClient
      .get<Paged<AdminTeaPacketRequest>>('/admin/tea-packet-requests', {
        params: toParams(query),
      })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient
      .get<AdminTeaPacketRequest>(`/admin/tea-packet-requests/${id}`)
      .then((response) => response.data),

  /**
   * `409 four-eyes-violation` when the approver raised the request at the counter
   * (BR-501), and `409 already-decided` when somebody else worked the same inbox.
   *
   * No `stale-eligibility`, and its absence is the design: there is no ceiling to go
   * stale. What *can* move between the queue rendering and the decision is the price,
   * which is why the server stamps `unitPrice` onto the record at the moment of the
   * decision rather than reading it back out of the catalogue afterwards.
   */
  approve: (id: string, body: DecisionBody) =>
    apiClient
      .post<AdminTeaPacketRequest>(`/admin/tea-packet-requests/${id}/approve`, body)
      .then((response) => response.data),

  reject: (id: string, body: DecisionBody) =>
    apiClient
      .post<AdminTeaPacketRequest>(`/admin/tea-packet-requests/${id}/reject`, body)
      .then((response) => response.data),
};
