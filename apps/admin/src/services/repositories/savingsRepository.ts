/**
 * M8 gateway.
 *
 * Thin, because the module is read-only: there is nothing to validate on the way out
 * when nothing goes out. It exists anyway rather than letting screens call the
 * endpoints directly, for the reason every repository here exists — it is the seam
 * that absorbs a shape difference when the real API arrives (operations.md →
 * Migrating from the mock layer), and a screen wired straight to a URL is a screen
 * that has to change when the URL does.
 */

import type {
  AdminSavingsLedgerEntry,
  Paged,
  SavingsAccount,
  SavingsAccountQuery,
  SavingsSummary,
} from '@tfd/domain';
import { savingsEndpoints } from '../endpoints/savings';

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
};
