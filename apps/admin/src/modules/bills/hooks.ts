/**
 * M5 queries and the one mutation.
 *
 * Generation invalidates wider than it looks like it should: recomputing a month
 * replaces every bill in it, moves §13's stage to `billsGenerated`, and changes what
 * the close checklist and the dashboard badge say. A mutation that only refreshed the
 * run summary would leave the grid showing the previous recomputation beside the new
 * totals — two answers on one screen, which is the failure this console is most
 * careful about.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BillQuery } from '@tfd/domain';
import { billRepository } from '@/services/repositories/billRepository';
import { qk } from '@/query/queryKeys';

export function useBills(query: BillQuery) {
  return useQuery({
    queryKey: qk.bills.list(query),
    queryFn: () => billRepository.list(query),
    // The grid keeps the previous page while the next arrives, so a filter change
    // does not blank a table the accountant is reading down.
    placeholderData: (previous) => previous,
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: qk.bills.detail(id ?? ''),
    queryFn: () => billRepository.get(id!),
    enabled: Boolean(id),
  });
}

/**
 * The month's run.
 *
 * `404 bills-missing` is a **state, not an error**: most months start without a run,
 * and the screen renders "not generated yet" from it. Retrying it would be retrying
 * the normal case.
 */
export function useBillRun(monthKey: string) {
  return useQuery({
    queryKey: qk.bills.run(monthKey),
    queryFn: () => billRepository.run(monthKey),
    enabled: Boolean(monthKey),
    retry: false,
  });
}

export function useGenerateBills(monthKey: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => billRepository.generate(monthKey),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.bills.all });
      // Generating occupies §13's `billsGenerated` stage, so the month, the close
      // checklist and the dashboard's cycle badge all move with it.
      void client.invalidateQueries({ queryKey: qk.months.all });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      void client.invalidateQueries({ queryKey: qk.audit.all });
    },
  });
}
