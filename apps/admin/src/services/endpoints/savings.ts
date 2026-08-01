/**
 * M8 Savings — read-only, and that is a decision rather than an omission.
 *
 * The scheme is simple to describe and the console's whole job is to describe it
 * accurately: a supplier chooses a per-kilo rate, it is deducted from their monthly
 * account, and the factory holds the money. So the balance is a **liability**, the
 * ledger is **derived from published bills**, and there is exactly one write path
 * for a contribution — the bill it came from.
 *
 * **What is deliberately not here.** §21.9 asks whether a supplier may withdraw,
 * with what notice, and whether interest is paid. Until it is answered:
 *
 *  - there is no withdrawal endpoint, because "the office can take money out of a
 *    supplier's savings" is a policy nobody has approved;
 *  - there is no interest posting, because the rate and the compounding period are
 *    the whole of the question;
 *  - `SavingsEntrySource` already carries `withdrawal` and `interest`, so answering
 *    §21.9 adds endpoints rather than migrating a money table.
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
};
