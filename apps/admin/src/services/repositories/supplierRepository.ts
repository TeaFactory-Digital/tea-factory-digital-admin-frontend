/**
 * M2 Suppliers — the registry gateway.
 *
 * Thin, because the shapes already match: `AdminSupplier` extends the app's
 * `Supplier`, which is the point of the shared domain package. What this layer
 * *does* own is the small number of guarantees the UI relies on and the wire does
 * not promise — ordering, and never letting a masked value be mistaken for a
 * real one.
 */

import type {
  AdminSupplier,
  Paged,
  RevealedBankDetails,
  SupplierEditable,
  SupplierIncomeHistory,
  SupplierNotificationStatus,
  SupplierListItem,
  SupplierQuery,
  SupplierRegistration,
  SupplierCredentialReset,
} from '@tfd/domain';
import { IDENTITY_CHECK_MIN, identityCheckProblem } from '@tfd/domain';
import { supplierEndpoints } from '../endpoints/suppliers';
import { ApiError } from '../api/errors';

export const supplierRepository = {
  list: (query: SupplierQuery = {}): Promise<Paged<SupplierListItem>> =>
    supplierEndpoints.list({ page: 0, pageSize: 50, ...query }),

  get: (id: string): Promise<AdminSupplier> => supplierEndpoints.get(id),

  income: (id: string, year?: number): Promise<SupplierIncomeHistory> =>
    supplierEndpoints.income(id, year),

  notifications: (id: string): Promise<SupplierNotificationStatus> =>
    supplierEndpoints.notifications(id),

  create: (body: SupplierRegistration): Promise<AdminSupplier> => supplierEndpoints.create(body),

  update: (id: string, body: Partial<SupplierEditable>): Promise<AdminSupplier> =>
    supplierEndpoints.update(id, body),

  suspend: (id: string, reason: string): Promise<AdminSupplier> =>
    supplierEndpoints.suspend(id, reason),

  reactivate: (id: string, reason: string): Promise<AdminSupplier> =>
    supplierEndpoints.reactivate(id, reason),

  close: (id: string, reason: string): Promise<AdminSupplier> =>
    supplierEndpoints.close(id, reason),

  /**
   * Never cached, never stored in React Query.
   *
   * A full account number that lands in the query cache stays in memory for the
   * rest of the session and is readable from any component that guesses the key.
   * The reveal is a one-shot mutation whose result the dialog holds and drops.
   */
  revealBankDetails: (id: string, reason: string): Promise<RevealedBankDetails> =>
    supplierEndpoints.revealBankDetails(id, reason),

  resetPassword: (id: string, reason: string) => supplierEndpoints.resetPassword(id, reason),
  /**
   * Issue a new app password.
   *
   * The identity check is guarded here as well as on the server, because it is the only
   * thing standing between a telephone request and an account takeover — and a clerk should
   * be stopped at the field, not after the credential has already been minted.
   */
  resetCredentials: async (id: string, reason: string): Promise<SupplierCredentialReset> => {
    if (identityCheckProblem(reason)) {
      throw new ApiError({
        code: 'note-required',
        message: 'Record how the supplier’s identity was checked.',
        details: { min: IDENTITY_CHECK_MIN },
      });
    }
    return supplierEndpoints.resetCredentials(id, reason.trim());
  },

};
