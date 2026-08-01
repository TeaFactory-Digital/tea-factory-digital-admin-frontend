/**
 * M4 Rates & month close — the irreversible module.
 *
 * Everything here is shaped by one fact: **publishing a month cannot be undone.**
 * A published month is immutable (BR-108), so M3 stops accepting leaf into it, the
 * bills built on its rate become the record, and a payout run pays against them.
 * That is why the endpoints are split the way they are:
 *
 *  - The rate is a `PUT`, because entering it twice before publishing is a
 *    *correction* — the office does mistype a figure — and a second `POST` would
 *    read as a second rate.
 *  - Exceptions are **records with ids**, not a count (api-contract.md §10.4). AC-04
 *    requires each one resolved, and a number cannot be worked through.
 *  - Publish carries the month key from the screen, so a console left open on July
 *    cannot close June.
 */

import type {
  MonthException,
  MonthExceptionQuery,
  MonthSummary,
  MonthlyRateEntry,
  Paged,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const monthEndpoints = {
  list: (query: { page?: number; pageSize?: number } = {}) =>
    apiClient
      .get<Paged<MonthSummary>>('/admin/months', { params: toParams(query) })
      .then((response) => response.data),

  get: (monthKey: string) =>
    apiClient.get<MonthSummary>(`/admin/months/${monthKey}`).then((response) => response.data),

  /** `409 month-locked` once published; `422 invalid-rate` for a figure that is not money. */
  setRate: (monthKey: string, body: MonthlyRateEntry) =>
    apiClient
      .put<MonthSummary>(`/admin/months/${monthKey}/rate`, body)
      .then((response) => response.data),

  exceptions: (monthKey: string, query: MonthExceptionQuery = {}) =>
    apiClient
      .get<Paged<MonthException>>(`/admin/months/${monthKey}/exceptions`, {
        params: toParams(query),
      })
      .then((response) => response.data),

  /** `422 note-required` — resolving without a reason is not resolving. */
  resolveException: (monthKey: string, id: string, note: string) =>
    apiClient
      .post<MonthException>(`/admin/months/${monthKey}/exceptions/${id}/resolve`, { note })
      .then((response) => response.data),

  /**
   * Four refusals, and each one is a month the office would otherwise have closed
   * wrongly: `rate-missing`, `exceptions-open` (AC-04), `already-published`, and
   * `four-eyes-violation` when the publisher entered the rate (BR-501).
   */
  publish: (monthKey: string, note?: string) =>
    apiClient
      .post<MonthSummary>(`/admin/months/${monthKey}/publish`, { monthKey, note })
      .then((response) => response.data),
};
