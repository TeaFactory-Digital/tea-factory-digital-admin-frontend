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
  SupplierCredentialReset,
  AdminSupplier,
  Paged,
  RevealedBankDetails,
  SupplierEditable,
  SupplierListItem,
  SupplierQuery,
  SupplierRegistration,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const supplierEndpoints = {
  list: (query: SupplierQuery) =>
    apiClient
      .get<Paged<SupplierListItem>>('/admin/suppliers', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient.get<AdminSupplier>(`/admin/suppliers/${id}`).then((response) => response.data),

  /** `409 supplier-code-taken` when the code exists **for this factory** (§16.2). */
  create: (body: SupplierRegistration) =>
    apiClient.post<AdminSupplier>('/admin/suppliers', body).then((response) => response.data),

  update: (id: string, body: Partial<SupplierEditable>) =>
    apiClient
      .patch<AdminSupplier>(`/admin/suppliers/${id}`, body)
      .then((response) => response.data),

  /**
   * Status changes carry a reason, and the reason is not optional.
   *
   * A supplier who finds their account suspended will phone the office, and
   * "suspended on the 14th" without a why is a conversation nobody in the office
   * can have. Same principle as AC-06 for rejections.
   */
  suspend: (id: string, reason: string) =>
    apiClient
      .post<AdminSupplier>(`/admin/suppliers/${id}/suspend`, { reason })
      .then((response) => response.data),

  reactivate: (id: string, reason: string) =>
    apiClient
      .post<AdminSupplier>(`/admin/suppliers/${id}/reactivate`, { reason })
      .then((response) => response.data),

  /**
   * Closing is not deleting. Nothing money-bearing is ever deleted (§12.1), so a
   * closed supplier keeps every bill, ledger entry and credit transaction.
   */
  close: (id: string, reason: string) =>
    apiClient
      .post<AdminSupplier>(`/admin/suppliers/${id}/close`, { reason })
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
      .post<RevealedBankDetails>(`/admin/suppliers/${id}/bank-details/reveal`, { reason })
      .then((response) => response.data),

  /**
   * **Provisional shape.** The app tells a supplier who has forgotten their
   * password to "contact the factory", and what the office then does is still an
   * open question (status.md §21.16) — who checks the supplier's identity, and
   * what the supplier receives. Until that is answered this returns an opaque
   * confirmation and issues nothing the console displays.
   */
  resetPassword: (id: string, reason: string) =>
    apiClient
      .post<{ issued: boolean; deliveredTo: 'sms' | 'office' | null }>(
        `/admin/suppliers/${id}/password-reset`,
        { reason },
      )
      .then((response) => response.data),
  /**
   * Issue a new app password (§21.16). Answers it **once** — not stored readably, not
   * re-fetchable. `422 note-required` without an identity check · `409 supplier-closed`.
   */
  resetCredentials: (id: string, reason: string) =>
    apiClient
      .post<SupplierCredentialReset>(`/admin/suppliers/${id}/credentials/reset`, { reason })
      .then((response) => response.data),

};
