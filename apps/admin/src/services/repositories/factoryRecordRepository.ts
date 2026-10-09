/**
 * The factory's records, kept here while the factory-system sync is off.
 *
 * Two translations happen here so the screens do not branch on HTTP:
 *  - an import refused for its rows comes back as a result with problems, not an error,
 *    because the dialog shows them row by row;
 *  - opening balances nobody has entered yet (`404`) are `null`.
 */

import type {
  BillAdjustment,
  ImportKind,
  ImportResult,
  ImportRow,
  ImportRowProblem,
  NewSupplier,
  OpeningBalances,
  OpeningBalancesRecord,
  SupplierTransportRate,
  WalkInCreditRequest,
} from '@tfd/domain';
import { ApiError } from '../api/errors';
import type { MutationAck } from '../api/adapters';
import { factoryRecordEndpoints } from '../endpoints/factoryRecords';

const isNotFound = (error: unknown) =>
  error instanceof ApiError && (error.code === 'not-found' || error.status === 404);

export const factoryRecordRepository = {
  importRows: async (kind: ImportKind, fileName: string, rows: ImportRow[]): Promise<ImportResult> => {
    try {
      return await factoryRecordEndpoints.importRows(kind, fileName, rows);
    } catch (error) {
      const problems = (error as ApiError).details as { problems?: ImportRowProblem[] } | undefined;
      if (error instanceof ApiError && error.status === 422 && problems?.problems) {
        return { kind, saved: 0, problems: problems.problems };
      }
      throw error;
    }
  },

  createSupplier: (body: NewSupplier): Promise<MutationAck> =>
    factoryRecordEndpoints.createSupplier(body),

  openingBalances: async (supplierId: string): Promise<OpeningBalancesRecord | null> => {
    try {
      return await factoryRecordEndpoints.openingBalances(supplierId);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  saveOpeningBalances: (
    supplierId: string,
    body: OpeningBalances & { note: string },
  ): Promise<OpeningBalancesRecord> => factoryRecordEndpoints.saveOpeningBalances(supplierId, body),

  saveTransportRate: (supplierId: string, body: SupplierTransportRate): Promise<MutationAck> =>
    factoryRecordEndpoints.saveTransportRate(supplierId, body),

  createWalkInCredit: (body: WalkInCreditRequest): Promise<MutationAck> =>
    factoryRecordEndpoints.createWalkInCredit(body),

  adjustBill: (billId: string, body: BillAdjustment): Promise<MutationAck> =>
    factoryRecordEndpoints.adjustBill(billId, body),
};
