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
  SupplierEditable,
  SupplierIncomeHistory,
  SupplierNotificationStatus,
  SupplierListItem,
  SupplierQuery,
  SupplierStatus,
  SupplierCredentialReset,
} from '@tfd/domain';
import { IDENTITY_CHECK_MIN, identityCheckProblem } from '@tfd/domain';
import { supplierEndpoints, type RevealedAccountNumber } from '../endpoints/suppliers';

/**
 * Re-exported so a screen can name what it is holding **without importing an endpoint**.
 *
 * The lint rule is the architecture: only a repository may reach into `endpoints/`, and
 * `ResetPasswordDialog` has to describe the credential it is showing once. Passing the
 * type through here rather than relaxing the rule keeps the one-way dependency intact —
 * screens know repositories, repositories know the wire.
 */
export type { RevealedAccountNumber };
import type { MutationAck, StatusAck } from '../api/adapters';
import { ApiError } from '../api/errors';

export const supplierRepository = {
  list: (query: SupplierQuery = {}): Promise<Paged<SupplierListItem>> =>
    supplierEndpoints.list({ page: 0, pageSize: 50, ...query }),

  get: (id: string): Promise<AdminSupplier> => supplierEndpoints.get(id),

  income: (id: string, year?: number): Promise<SupplierIncomeHistory> =>
    supplierEndpoints.income(id, year),

  notifications: (id: string): Promise<SupplierNotificationStatus> =>
    supplierEndpoints.notifications(id),

  /**
   * There is **no `create`**.
   *
   * The API has no `POST /admin/suppliers`, and the v2 console has no screen that would
   * call one: the register is replicated from the factory's own system, and this console
   * manages the *app* side of a supplier rather than inventing the supplier. A method
   * here would be a lever with nothing behind it. See gap **G-01** if that changes.
   */
  update: (id: string, body: Partial<SupplierEditable>): Promise<MutationAck> =>
    supplierEndpoints.update(id, body),

  /**
   * The three status changes, still spelled as three verbs at this seam.
   *
   * The API models one transition (`POST .../status`) and the screens ask three
   * questions — *suspend this account*, *let them back in*, *close it* — so the
   * translation belongs here rather than in a dialog that would have to remember which
   * string the server wants. It also keeps the reason mandatory on all three, which a
   * single `setStatus(id, status, reason)` at the call site would eventually not.
   */
  suspend: (id: string, reason: string): Promise<StatusAck<SupplierStatus>> =>
    supplierEndpoints.setStatus(id, 'suspended', reason),

  reactivate: (id: string, reason: string): Promise<StatusAck<SupplierStatus>> =>
    supplierEndpoints.setStatus(id, 'active', reason),

  /**
   * Closing is not deleting. Nothing money-bearing is ever deleted (§12.1), so a
   * closed supplier keeps every bill, ledger entry and credit transaction.
   */
  close: (id: string, reason: string): Promise<StatusAck<SupplierStatus>> =>
    supplierEndpoints.setStatus(id, 'closed', reason),

  /**
   * Never cached, never stored in React Query.
   *
   * A full account number that lands in the query cache stays in memory for the
   * rest of the session and is readable from any component that guesses the key.
   * The reveal is a one-shot mutation whose result the dialog holds and drops.
   */
  revealBankDetails: (id: string, reason: string): Promise<RevealedAccountNumber> =>
    supplierEndpoints.revealBankDetails(id, reason),

  /**
   * Issue a new app password.
   *
   * The identity check is guarded here as well as on the server, because it is the only
   * thing standing between a telephone request and an account takeover — and a clerk should
   * be stopped at the field, not after the credential has already been minted.
   */
  resetCredentials: async (id: string, identityCheckNote: string): Promise<SupplierCredentialReset> => {
    if (identityCheckProblem(identityCheckNote)) {
      throw new ApiError({
        code: 'note-required',
        message: 'Record how the supplier’s identity was checked.',
        details: { min: IDENTITY_CHECK_MIN },
      });
    }
    return supplierEndpoints.resetCredentials(id, identityCheckNote.trim());
  },

};
