/**
 * M16 gateway.
 *
 * The one guard is the parameter check, run with the **shared** `missingReportParams` so the
 * console can disable the button and the server can refuse with the same rule. A report run
 * with no month is not an empty result — it is a question nobody asked, and answering it with
 * an empty grid would read as "no leaf that month".
 */

import {
  missingReportParams,
  type ReportCatalogue,
  type ReportId,
  type ReportResult,
  type ReportRunParams,
} from '@tfd/domain';
import { reportEndpoints } from '../endpoints/reports';
import { ApiError } from '../api/errors';

export const reportRepository = {
  list: (): Promise<ReportCatalogue> => reportEndpoints.list(),

  run: async (id: ReportId, params: ReportRunParams): Promise<ReportResult> => {
    const missing = missingReportParams(id, params);
    if (missing.length > 0) {
      throw new ApiError({
        code: 'invalid',
        message: 'That report needs more than it was given.',
        details: { missing },
      });
    }
    return reportEndpoints.run(id, params);
  },

  /**
   * Savings held, month by month, oldest first; `null` while the API does not serve the
   * report yet (it answers `404`), so the screen can say so instead of showing an error.
   * Read only: the figures are the factory system's.
   */
  savingsHeld: async (): Promise<SavingsMonth[] | null> => {
    let served: { rows?: Array<Record<string, unknown>> };
    try {
      served = (await reportEndpoints.run('savingsHeld' as ReportId, {})) as unknown as typeof served;
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'not-found' || error.status === 404)) {
        return null;
      }
      throw error;
    }
    return (served.rows ?? [])
      .map((row) => ({
        monthKey: String(row.monthKey ?? ''),
        paidIn: Number(row.paidIn ?? 0),
        // Sent as a positive amount; a negative one is read the same way.
        takenOut: Math.abs(Number(row.takenOut ?? 0)),
        balanceTotal: Number(row.balanceTotal ?? 0),
        suppliersSaving: Number(row.suppliersSaving ?? 0),
      }))
      .filter((row) => /^\d{4}-\d{2}$/.test(row.monthKey))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  },

  /**
   * App use, month by month: every month there are requests, oldest first.
   *
   * Read from the `channelShift` report, whichever shape the API sends: the current API
   * sends `total`, `fromApp` and `appShare` (no office count) and ignores a date range, so
   * the range is applied on the screen and the office count is `total - fromApp`.
   */
  appUse: async (): Promise<AppUseMonth[]> => {
    const served = (await reportEndpoints.run('channelShift', {})) as unknown as {
      rows?: Array<Record<string, unknown>>;
    };
    return (served.rows ?? [])
      .map((row) => {
        const total = Number(row.total ?? 0);
        const fromApp = Number(row.fromApp ?? 0);
        const fromOffice =
          row.fromOffice !== undefined ? Number(row.fromOffice) : Math.max(0, total - fromApp);
        return {
          monthKey: String(row.monthKey ?? row.month_key ?? ''),
          total,
          fromApp,
          fromOffice,
          // 0 to 1, or `null` for a month with no requests: a share of nothing is not 0%.
          appShare: total > 0 ? fromApp / total : null,
        };
      })
      .filter((row) => /^\d{4}-\d{2}$/.test(row.monthKey))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  },
};

/**
 * Savings held by the factory, month by month (BACKEND-TODO #27): what suppliers paid in,
 * what was taken out, and the balance held at the end of the month.
 */
export interface SavingsMonth {
  monthKey: string;
  paidIn: number;
  takenOut: number;
  /** Total balance held for all suppliers at the end of the month. */
  balanceTotal: number;
  /** Suppliers with a balance above zero at the end of the month. */
  suppliersSaving: number;
}

export interface AppUseMonth {
  monthKey: string;
  total: number;
  fromApp: number;
  fromOffice: number;
  appShare: number | null;
}
