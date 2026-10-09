/**
 * The factory's records, kept here while the factory-system sync is off.
 *
 * One record at a time, and many at once from a file. The whole contract, with each
 * refusal, is in `docs/v2/factory-records.md`.
 */

import type {
  BillAdjustment,
  ImportKind,
  ImportResult,
  ImportRow,
  NewSupplier,
  OpeningBalances,
  OpeningBalancesRecord,
  SupplierTransportRate,
  WalkInCreditRequest,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import type { MutationAck } from '../api/adapters';

export const factoryRecordEndpoints = {
  /** `422 import-invalid` with `details.problems` when any row is wrong; nothing is saved. */
  importRows: (kind: ImportKind, fileName: string, rows: ImportRow[]) =>
    apiClient
      .post<ImportResult>(`/admin/imports/${kind}`, { fileName, rows })
      .then((response) => response.data),

  /** `409 supplier-code-taken` · `422 bank-details-required`. */
  createSupplier: (body: NewSupplier) =>
    apiClient.post<MutationAck>('/admin/suppliers', body).then((response) => response.data),

  /** `null` (404) until somebody enters them. */
  openingBalances: (supplierId: string) =>
    apiClient
      .get<OpeningBalancesRecord>(`/admin/suppliers/${supplierId}/opening-balances`)
      .then((response) => response.data),

  /** `409 opening-balances-locked` once a bill has been generated for the supplier. */
  saveOpeningBalances: (supplierId: string, body: OpeningBalances & { note: string }) =>
    apiClient
      .put<OpeningBalancesRecord>(`/admin/suppliers/${supplierId}/opening-balances`, body)
      .then((response) => response.data),

  /** The supplier's own transport rate; `null` puts them back on the point's. */
  saveTransportRate: (supplierId: string, body: SupplierTransportRate) =>
    apiClient
      .put<MutationAck>(`/admin/suppliers/${supplierId}/transport-rate`, body)
      .then((response) => response.data),

  /** A request made at the counter. It joins the queue as `pending`, channel `office`. */
  createWalkInCredit: (body: WalkInCreditRequest) =>
    apiClient
      .post<MutationAck>('/admin/credit-requests', body)
      .then((response) => response.data),

  /** `409 month-locked` once the month is published. */
  adjustBill: (billId: string, body: BillAdjustment) =>
    apiClient
      .put<MutationAck>(`/admin/bills/${billId}/adjustment`, body)
      .then((response) => response.data),
};
