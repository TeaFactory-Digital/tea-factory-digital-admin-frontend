/**
 * M8 Savings — read-only, and that is a decision rather than an omission.
 *
 * The scheme is simple to describe and the console's whole job is to describe it
 * accurately: a supplier chooses a per-kilo rate, it is deducted from their monthly
 * account, and the factory holds the money. So the balance is a **liability**, the
 * ledger is **derived from published bills**, and there is exactly one write path
 * for a contribution — the bill it came from.
 *
 * **§21.9 has been answered, and the shape held.** The factory's answer: a supplier may
 * take their savings out, normally in April but the month must be changeable; interest is
 * changeable too and starts at 0% a year. `SavingsEntrySource` already carried `withdrawal`
 * and `interest` for exactly this, so it added the two endpoints below rather than a
 * migration on money data.
 *
 * Two properties of that answer shape everything here:
 *
 *  - **A withdrawal is paid on the next Green Leaf Account**, so `requestWithdrawal` moves
 *    nothing. It records an intention; M5 puts it on a bill; the passbook moves when that
 *    bill is published. One rule — the ledger is derived from published bills — rather than
 *    a second write path for the same money.
 *  - **Interest is stored and never applied.** Nobody has said simple or compound, closing
 *    balance or the year's minimum, and those pay materially different amounts. So there is
 *    still no interest posting: the accountant records one when the factory decides.
 *
 * The savings **rate** is not set here either — it belongs to the supplier and moves
 * through M9's change-request queue (AC-01), which is where the four-eyes rule and
 * the audit trail already are.
 */

import type {
  AdminSavingsLedgerEntry,
  Paged,
  SavingsAccount,
  SavingsAccountQuery,
  SavingsSummary,
  SavingsWithdrawal,
  SavingsWithdrawalState,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const savingsEndpoints = {
  /** Factory-wide totals for a month. Omit the key for the latest with contributions. */
  summary: (monthKey?: string) =>
    apiClient
      .get<SavingsSummary>('/admin/savings/summary', { params: toParams({ monthKey }) })
      .then((response) => response.data),

  accounts: (query: SavingsAccountQuery = {}) =>
    apiClient
      .get<Paged<SavingsAccount>>('/admin/savings/accounts', { params: toParams(query) })
      .then((response) => response.data),

  /**
   * One supplier's passbook, **oldest first**.
   *
   * The order is part of the contract, not a preference: a running balance only
   * means anything read in the direction it accumulated, and reversing it would put
   * the closing figure at the top with nothing above it to explain the total.
   */
  ledger: (supplierId: string, query: { page?: number; pageSize?: number } = {}) =>
    apiClient
      .get<Paged<AdminSavingsLedgerEntry>>(`/admin/savings/accounts/${supplierId}/ledger`, {
        params: toParams(query),
      })
      .then((response) => response.data),

  /** The scheme's rules and this supplier's outstanding requests, in one answer. */
  withdrawals: (supplierId: string) =>
    apiClient
      .get<SavingsWithdrawalState>(`/admin/savings/accounts/${supplierId}/withdrawals`)
      .then((response) => response.data),

  /**
   * Record a request. `422 note-required` · `409 window-closed` ·
   * `422 exceeds-available` · `422 no-balance` · `422 not-positive`.
   */
  requestWithdrawal: (supplierId: string, amount: number, reason: string) =>
    apiClient
      .post<SavingsWithdrawal>(`/admin/savings/accounts/${supplierId}/withdrawals`, {
        amount,
        reason,
      })
      .then((response) => response.data),

  /** `409 already-settled` once the bill that paid it is published. */
  cancelWithdrawal: (id: string, reason: string) =>
    apiClient
      .post<SavingsWithdrawal>(`/admin/savings/withdrawals/${id}/cancel`, { reason })
      .then((response) => response.data),
};
