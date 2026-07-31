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
  SupplierListItem,
  SupplierQuery,
  SupplierRegistration,
} from '@tfd/domain';
import { supplierEndpoints } from '../endpoints/suppliers';

export const supplierRepository = {
  list: (query: SupplierQuery = {}): Promise<Paged<SupplierListItem>> =>
    supplierEndpoints.list({ page: 0, pageSize: 50, ...query }),

  get: (id: string): Promise<AdminSupplier> => supplierEndpoints.get(id),

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
};
