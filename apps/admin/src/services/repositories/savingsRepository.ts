/**
 * M8 gateway.
 *
 * Thin, and the one guard is `withdrawalProblems` — run here as well as on the server so
 * the screen can withhold the control and name the reason before a round trip, with the
 * *same* rule the API refuses with. It exists anyway rather than letting screens call the
 * endpoints directly, for the reason every repository here exists — it is the seam
 * that absorbs a shape difference when the real API arrives (operations.md →
 * Migrating from the mock layer), and a screen wired straight to a URL is a screen
 * that has to change when the URL does.
 */

import {
  withdrawalProblems,
  type AdminSavingsLedgerEntry,
  type Paged,
  type SavingsAccount,
  type SavingsAccountQuery,
  type SavingsSummary,
  type SavingsWithdrawal,
  type SavingsWithdrawalState,
} from '@tfd/domain';
import { savingsEndpoints } from '../endpoints/savings';
import { ApiError } from '../api/errors';

export const savingsRepository = {
  summary: (monthKey?: string): Promise<SavingsSummary> => savingsEndpoints.summary(monthKey),

  accounts: (query: SavingsAccountQuery = {}): Promise<Paged<SavingsAccount>> =>
    savingsEndpoints.accounts({ page: 0, pageSize: 50, ...query }),

  /**
   * A supplier's whole passbook in one page.
   *
   * A savings history is a handful of rows per year, and the balance column only
   * makes sense read from the start — so paging it would cut a running total in half.
   */
  ledger: (supplierId: string): Promise<Paged<AdminSavingsLedgerEntry>> =>
    savingsEndpoints.ledger(supplierId, { page: 0, pageSize: 200 }),

  withdrawals: (supplierId: string): Promise<SavingsWithdrawalState> =>
    savingsEndpoints.withdrawals(supplierId),

  /**
   * Ask for savings back (§21.9).
   *
   * Checked here first against the state the screen is already holding, so the refusal
   * names the rule — a shut window and an over-draw are different problems with different
   * answers, and a single "invalid" would send the office to the wrong one.
   */
  requestWithdrawal: async (
    supplierId: string,
    amount: number,
    reason: string,
    context: SavingsWithdrawalState,
  ): Promise<SavingsWithdrawal> => {
    const problems = withdrawalProblems({
      amount,
      balance: context.balance,
      pendingTotal: context.pendingTotal,
      policy: context.policy,
      now: new Date(),
    });
    if (problems.length > 0) {
      throw new ApiError({
        code: problems[0]!,
        message: 'That withdrawal cannot be recorded.',
        details: { problems, available: context.available, policy: context.policy },
      });
    }
    return savingsEndpoints.requestWithdrawal(supplierId, amount, reason);
  },

  cancelWithdrawal: (id: string, reason: string): Promise<SavingsWithdrawal> =>
    savingsEndpoints.cancelWithdrawal(id, reason),
};
