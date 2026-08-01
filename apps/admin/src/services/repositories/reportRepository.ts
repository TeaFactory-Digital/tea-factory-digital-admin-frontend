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
};
