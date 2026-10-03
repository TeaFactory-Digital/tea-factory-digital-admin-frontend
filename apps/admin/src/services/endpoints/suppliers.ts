/**
 * M2 Suppliers — the registry.
 *
 * The one thing here that is a security control rather than a feature:
 * **bank account numbers arrive masked**, and the full number is a separate
 * call that the server audits (§20.4). A payload that carried the real number
 * and trusted the console to hide it would not be a control at all — it would be
 * a full account number sitting in the browser's network tab for anyone who
 * opened devtools.
 */

import type {
  AdminSupplier,
  Paged,
  SupplierEditable,
  SupplierIncomeHistory,
  SupplierListItem,
  SupplierNotificationStatus,
  SupplierQuery,
  SupplierStatus,
  SupplierCredentialReset,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import type { MutationAck, StatusAck } from '../api/adapters';
import { toParams } from './params';

/**
 * What the reveal actually answers with.
 *
 * `RevealedBankDetails` promises the bank and branch beside the number; the API sends the
 * number and the audit id alone (gap **G-05**). Naming that honestly here is what stops
 * the dialog rendering two empty definition rows above the one value it asked for — the
 * bank and branch are already on the supplier record the dialog was opened from.
 */
export interface RevealedAccountNumber {
  accountNumber: string;
  /** The audit entry this reveal produced, so the UI can prove it was recorded. */
  auditId: string;
}


export const supplierEndpoints = {
  list: (query: SupplierQuery) =>
    apiClient
      .get<Paged<SupplierListItem>>('/admin/suppliers', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient.get<AdminSupplier>(`/admin/suppliers/${id}`).then((response) => response.data),

  /**
   * This supplier's months — the same series the app shows them.
   *
   * Its own endpoint rather than `GET /admin/bills?supplierId=`, and the difference is
   * shape rather than data: the bills list is a **page** of bills and this is a
   * **series** over a year, with the years that have anything in them travelling
   * alongside so the picker cannot come back empty. Both read the same bills.
   *
   * `year` omitted means the most recent year with data — which is what the screen
   * should open on, and working it out client-side would need a round trip to discover
   * what to ask for.
   */
  income: (id: string, year?: number) =>
    apiClient
      .get<SupplierIncomeHistory>(`/admin/suppliers/${id}/income`, {
        params: toParams({ year }),
      })
      .then((response) => response.data),

  /**
   * Why this supplier would or would not receive a push — **per category**.
   *
   * The aggregate reach panel in M13 answers "how many will this reach"; this answers
   * "why did *he* not get it", which is the question the office is actually asked and
   * which no count can answer.
   */
  notifications: (id: string) =>
    apiClient
      .get<SupplierNotificationStatus>(`/admin/suppliers/${id}/notifications`)
      .then((response) => response.data),

  /**
   * Answers `{ id }`, not the updated record (gap **G-11**) — the hooks invalidate and
   * refetch, so nothing downstream reads the response body.
   */
  update: (id: string, body: Partial<SupplierEditable>) =>
    apiClient
      .patch<MutationAck>(`/admin/suppliers/${id}`, body)
      .then((response) => response.data),

  /**
   * Suspend, reactivate and close — **one endpoint, because they are one state machine.**
   *
   * The console used to spell them as three verbs (`/suspend`, `/reactivate`, `/close`);
   * the API models the transition instead, which is the better shape: there is exactly
   * one place that decides whether `closed → active` is legal, and it is not three
   * handlers that have to agree.
   *
   * The reason is not optional, and that is unchanged. A supplier who finds their account
   * suspended will telephone the office, and "suspended on the 14th" with no why is a
   * conversation nobody there can have — the same principle as AC-06 for rejections. The
   * API enforces a floor of its own, so a short reason comes back as
   * `422 note-required` rather than being quietly accepted.
   *
   * **Closing is not deleting** (Q10, BR-504). Nothing money-bearing is ever removed, so
   * a closed supplier keeps every bill, ledger entry and credit transaction, and there is
   * no `DELETE` on this resource at all.
   */
  setStatus: (id: string, status: SupplierStatus, reason: string) =>
    apiClient
      .post<StatusAck<SupplierStatus>>(`/admin/suppliers/${id}/status`, { status, reason })
      .then((response) => response.data),

  /**
   * The full account number, returned once, with the audit id of the record the
   * reveal produced — so the UI can tell the clerk it was logged, which is the
   * point of auditing it.
   *
   * `reason` is required: an audit entry that records *that* someone looked
   * without recording *why* answers the wrong question.
   */
  revealBankDetails: (id: string, reason: string) =>
    apiClient
      .post<RevealedAccountNumber>(`/admin/suppliers/${id}/bank-details/reveal`, { reason })
      .then((response) => response.data),

  /**
   * Issue a new app password (§21.16). Answers it **once** — not stored readably, not
   * re-fetchable. `422 note-required` without an identity check · `409 supplier-closed`.
   */
  /**
   * Issue a new app password (§21.16). Answers it **once** — not stored readably, not
   * re-fetchable. `422 note-required` without an identity check · `409 supplier-closed`.
   *
   * The field is **`identityCheckNote`**, not `reason`, and the name is the requirement:
   * this is the one note in the console that records *how the person on the telephone was
   * shown to be the supplier*, and a field called `reason` invites "supplier asked for a
   * reset" — which is exactly the note that makes the control worthless. The API's floor
   * is 15 characters against 10 everywhere else, for the same reason.
   *
   * It answers the whole `SupplierCredentialReset` — password, `issuedAt`, `issuedByName`
   * and the `auditId` of the record the reset produced. **G-04 is closed**: the dialog no
   * longer has to attribute the act to whoever happens to be signed in, and the audit id
   * it prints is one a support conversation can quote.
   */
  resetCredentials: (id: string, identityCheckNote: string) =>
    apiClient
      .post<SupplierCredentialReset>(`/admin/suppliers/${id}/credentials/reset`, { identityCheckNote })
      .then((response) => response.data),

};
