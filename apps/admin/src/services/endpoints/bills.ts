/**
 * M5 Bills: the read model, and the one act that writes it.
 *
 * A bill is **derived, not authored** (api.md §16): daily deliveries and a monthly
 * rate are the facts, and a bill is what falls out of them. That single sentence
 * shapes every endpoint here:
 *
 *  - There is **no `PATCH`**. A wrong bill is a wrong delivery or a wrong rate, and
 *    the fix is upstream in M3 or M4 followed by a re-generation. A bill editor
 *    would let the office correct the symptom and leave the cause in place, so the
 *    next run would reintroduce it.
 *  - `generate` is a `POST` that may be **repeated**, because recomputing is what it
 *    does. It is refused once the month is published (BR-108), which is the moment
 *    the bills become the documents suppliers hold.
 *  - Whether a *published* bill may be corrected is §21.8 and still unanswered. The
 *    console assumes it may not. If the factory says otherwise, that is a new
 *    audited reversal endpoint, never a relaxation of the lock.
 */

import type {
  AdminBill,
  BillListItem,
  BillMonth,
  BillQuery,
  BillRun,
  MonthSlipComparison,
  Paged,
  SlipComparisonRow,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const billEndpoints = {
  /**
   * The months a money screen can be pointed at.
   *
   * Its own endpoint rather than `GET /admin/months`, which §12.1 gates on
   * `ratesAndMonthClose`: a capability the clerk does not have while still holding
   * `billing: R`. A picker is not a reason to widen access to the month close.
   */
  months: () =>
    apiClient.get<BillMonth[]>('/admin/bill-months').then((response) => response.data),

  list: (query: BillQuery = {}) =>
    apiClient
      .get<Paged<BillListItem>>('/admin/bills', { params: toParams(query) })
      .then((response) => response.data),

  /** The full slip. Field-for-field what the app's Home screen shows (AC-03). */
  get: (id: string) =>
    apiClient.get<AdminBill>(`/admin/bills/${id}`).then((response) => response.data),

  /**
   * The month's run, or `404 bills-missing`.
   *
   * A `404` rather than an empty run: "the bills have not been built" and "they were
   * built and came to nothing" are different answers, and the close checklist
   * branches on which one it got.
   */
  run: (monthKey: string) =>
    apiClient
      .get<BillRun>(`/admin/months/${monthKey}/bill-run`)
      .then((response) => response.data),

  /**
   * Recompute the month's bills.
   *
   * Called from the bill run card on Rates & month close, only while the factory keeps its
   * records here and calculates its bills (`billSettings.source: 'calculated'`); a factory
   * that imports them answers `409 wrong-bill-source`.
   *
   * `409 month-locked` once published · `409 rate-missing` with no auction result ·
   * `422 bills-unbalanced` if any slip's lines disagree with its total (BR-107).
   */
  generate: (monthKey: string) =>
    apiClient
      .post<BillRun>(`/admin/months/${monthKey}/bills/generate`, { monthKey })
      .then((response) => response.data),

  /**
   * Ours against the factory's printed slips (`compareWithSlip`): the counts, and every bill
   * that is not a plain match. Only a factory that calculates its bills here with the sync
   * off; any other answers `409 wrong-bill-source`.
   */
  slipComparison: (monthKey: string) =>
    apiClient
      .get<MonthSlipComparison>(`/admin/months/${monthKey}/slip-comparison`)
      .then((response) => response.data),

  /** The printed slip's "Balance" for one bill; `null` clears it. `409 month-locked` once published. */
  setPrinted: (billId: string, finalBalance: number | null) =>
    apiClient
      .put<SlipComparisonRow>(`/admin/bills/${billId}/printed`, { finalBalance })
      .then((response) => response.data),

  /** Keep a bill back from publishing. A reason of 10+ characters. */
  hold: (billId: string, reason: string) =>
    apiClient
      .post<SlipComparisonRow>(`/admin/bills/${billId}/hold`, { reason })
      .then((response) => response.data),

  /**
   * Let a held bill go once it matches (`409 bill-still-mismatched` otherwise). In a month
   * already published this publishes the one bill.
   */
  release: (billId: string) =>
    apiClient
      .post<SlipComparisonRow & { published: boolean }>(`/admin/bills/${billId}/release`)
      .then((response) => response.data),
};
