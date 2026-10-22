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
  ImportRequest,
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
import { IMPORT_SKIP_ON_SERVER } from '@/lib/serverReady';

const isNotFound = (error: unknown) =>
  error instanceof ApiError && (error.code === 'not-found' || error.status === 404);

export const factoryRecordRepository = {
  /**
   * `dryRun` checks without saving; `duplicates` says what to do with leaf already
   * recorded. Neither is sent until the API takes them (`IMPORT_SKIP_ON_SERVER`): an API
   * that ignored `dryRun` would save the file on the preview.
   */
  importRows: async (
    kind: ImportKind,
    fileName: string,
    rows: ImportRow[],
    options: Pick<ImportRequest, 'dryRun' | 'duplicates'> = {},
  ): Promise<ImportResult> => {
    if (options.dryRun && !IMPORT_SKIP_ON_SERVER) {
      throw new Error('A dry run is not sent to an API that would save the file.');
    }
    try {
      return await factoryRecordEndpoints.importRows(kind, fileName, rows, IMPORT_SKIP_ON_SERVER ? options : {});
    } catch (error) {
      const problems = (error as ApiError).details as
        | { problems?: ImportRowProblem[]; total?: number }
        | undefined;
      if (error instanceof ApiError && error.status === 422 && problems?.problems) {
        return {
          kind,
          saved: 0,
          problems: problems.problems,
          problemTotal: problems.total ?? problems.problems.length,
        };
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
