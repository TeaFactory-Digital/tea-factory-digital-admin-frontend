/**
 * M4 queries and mutations.
 *
 * The invalidation here is wider than any other module's, and deliberately so.
 * Publishing a month changes what four other screens are allowed to do: M3 stops
 * accepting leaf into it (BR-108), the dashboard's cycle badge moves, the audit
 * trail gains the entry that justifies the close, and every month list showing the
 * stage is stale. A publish that only refreshed this screen would leave a weighing
 * point entering leaf into a closed month until someone reloaded.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MonthlyRateEntry } from '@tfd/domain';
import { monthRepository } from '@/services/repositories/monthRepository';
import { qk } from '@/query/queryKeys';

export function useMonths() {
  return useQuery({
    queryKey: qk.months.list,
    queryFn: () => monthRepository.list(),
  });
}

export function useMonth(monthKey: string) {
  return useQuery({
    queryKey: qk.months.detail(monthKey),
    queryFn: () => monthRepository.get(monthKey),
  });
}

export function useMonthExceptions(monthKey: string, resolved?: boolean) {
  return useQuery({
    queryKey: qk.months.exceptions(monthKey, resolved),
    queryFn: () => monthRepository.exceptions(monthKey, { resolved }),
    placeholderData: (previous) => previous,
  });
}

/** Everything a month-level change makes stale, in one place. */
function useInvalidateMonth(monthKey: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.months.all });
    void client.invalidateQueries({ queryKey: qk.dashboard });
    void client.invalidateQueries({ queryKey: qk.audit.all });
    // M3's day summaries carry `locked` and the stage, so they change with the
    // month even though no delivery did.
    void client.invalidateQueries({ queryKey: qk.deliveries.all });
    /**
     * M5's run goes stale on a rate change and its bills are stamped published on a
     * close, and M8's ledger gains a month's contributions at that same moment.
     *
     * Named here rather than left to those screens because the event belongs to the
     * month: a publish that only refreshed M4 would leave the bills grid showing
     * drafts of documents suppliers can already see, and a savings balance a month
     * behind the slip it came from.
     */
    void client.invalidateQueries({ queryKey: qk.bills.all });
    void client.invalidateQueries({ queryKey: qk.savings.all });
    void client.invalidateQueries({ queryKey: qk.months.detail(monthKey) });
  };
}

export function useSetMonthlyRate(monthKey: string) {
  const invalidate = useInvalidateMonth(monthKey);
  return useMutation({
    mutationFn: (body: MonthlyRateEntry) => monthRepository.setRate(monthKey, body),
    onSuccess: invalidate,
  });
}

export function useResolveException(monthKey: string) {
  const invalidate = useInvalidateMonth(monthKey);
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      monthRepository.resolveException(monthKey, id, note),
    onSuccess: invalidate,
  });
}

export function usePublishMonth(monthKey: string) {
  const invalidate = useInvalidateMonth(monthKey);
  return useMutation({
    mutationFn: (note?: string) => monthRepository.publish(monthKey, note),
    onSuccess: invalidate,
  });
}
