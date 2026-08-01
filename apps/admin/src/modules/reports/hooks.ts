/**
 * M16 queries. There are no mutations, and there never will be — a report is asked for and
 * answered, never stored.
 */

import { useQuery } from '@tanstack/react-query';
import type { ReportId, ReportRunParams } from '@tfd/domain';
import { reportRepository } from '@/services/repositories/reportRepository';
import { qk } from '@/query/queryKeys';

/**
 * The reports, and the months they can be run over.
 *
 * One query for both, because the month list has to sit behind the `reports` grant: a factory
 * administrator holds `reports: R` and `billing: none` (§12.1), and a picker fed from M5's
 * month endpoint left them unable to run a month report at all.
 */
export function useReportCatalogue() {
  return useQuery({
    queryKey: qk.reports.list,
    queryFn: () => reportRepository.list(),
    // The set of reports changes when the warehouse does, not during a session. The months
    // change when a month closes, which is not something that happens while reading a report.
    staleTime: 5 * 60_000,
  });
}

/**
 * Run one, when it has everything it needs.
 *
 * `enabled` rather than an early return, because a report with a missing parameter must not be
 * *asked* — an empty grid reads as "nothing that month", which is the one wrong answer this
 * screen can give.
 */
export function useReportRun(id: ReportId | undefined, params: ReportRunParams, ready: boolean) {
  return useQuery({
    queryKey: qk.reports.run(id ?? '', params),
    queryFn: () => reportRepository.run(id!, params),
    enabled: Boolean(id) && ready,
    // A report is expensive and its inputs rarely move within a minute of running it.
    staleTime: 60_000,
  });
}
