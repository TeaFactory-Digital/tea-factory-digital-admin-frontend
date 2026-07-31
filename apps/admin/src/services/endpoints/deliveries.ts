/**
 * M3 Leaf collection — where the leaf is recorded.
 *
 * Two things here are contract, not convenience:
 *
 *  1. **A weighing session is one request.** `createBatch` posts every row the
 *     grid holds in a single call. A row-per-request design turns a 200-row
 *     session into 200 round trips on a connection shared with the office
 *     telephones, which is how a data-entry product loses to a paper ledger.
 *  2. **The batch id is the idempotency key.** The transport generates a fresh
 *     `Idempotency-Key` per request; a commit overrides it with the session's own
 *     id so that a clerk who clicks again after a dropped connection gets the
 *     original result back instead of recording the whole session twice.
 */

import type {
  CollectionDaySummary,
  Delivery,
  DeliveryBatch,
  DeliveryBatchResult,
  DeliveryQuery,
  Paged,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const deliveryEndpoints = {
  list: (query: DeliveryQuery) =>
    apiClient
      .get<Paged<Delivery>>('/admin/deliveries', { params: toParams(query) })
      .then((response) => response.data),

  /**
   * The day's totals, server-composed.
   *
   * Not derived from the list page: a page is 50 rows and a day at a busy point
   * is more, so a console adding up what it happens to be showing would print a
   * total that disagrees with the dashboard and with the month close.
   */
  summary: (query: { date: string; collectionPoint?: string }) =>
    apiClient
      .get<CollectionDaySummary>('/admin/deliveries/summary', { params: toParams(query) })
      .then((response) => response.data),

  /**
   * `409 month-locked` once the month is published (BR-108), and per-row refusals
   * inside a `200` for anything wrong with an individual line.
   */
  createBatch: (body: DeliveryBatch) =>
    apiClient
      .post<DeliveryBatchResult>('/admin/deliveries', body, {
        headers: { 'Idempotency-Key': body.batchId },
      })
      .then((response) => response.data),

  /**
   * Voiding, not deleting (§12.1).
   *
   * A delivery that was recorded and withdrawn is a kilo figure the office may
   * have to account for, so the row survives with who voided it and why. The
   * reason is mandatory — `422 note-required` otherwise.
   */
  void: (id: string, reason: string) =>
    apiClient
      .post<Delivery>(`/admin/deliveries/${id}/void`, { reason })
      .then((response) => response.data),
};
