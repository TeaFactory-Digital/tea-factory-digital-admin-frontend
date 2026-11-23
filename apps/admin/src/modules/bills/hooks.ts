/**
 * M5 queries and the one mutation.
 *
 * Generation invalidates wider than it looks like it should: recomputing a month
 * replaces every bill in it, moves §13's stage to `billsGenerated`, and changes what
 * the close checklist and the dashboard badge say. A mutation that only refreshed the
 * run summary would leave the grid showing the previous recomputation beside the new
 * totals: two answers on one screen, which is the failure this console is most
 * careful about.
 */

import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { billSourceOf, isFactorySyncEnabled, type BillQuery } from '@tfd/domain';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { SLIP_COMPARISON_ON_SERVER } from '@/lib/serverReady';
import { billRepository } from '@/services/repositories/billRepository';
import { qk } from '@/query/queryKeys';
import { previousMonthKey } from './lastMonth';

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

/** Does this factory compare its bills with printed slips? Sync off, bills calculated here. */
export function useComparesWithSlips(): boolean {
  const { config } = useRuntimeConfig();
  return (
    SLIP_COMPARISON_ON_SERVER &&
    !isFactorySyncEnabled(config) &&
    billSourceOf(config.billSettings) === 'calculated'
  );
}

/**
 * Ours against the factory's printed slips. Only asked for where it applies (`enabled`),
 * because any other factory answers `409 wrong-bill-source`.
 */
export function useSlipComparison(monthKey: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.bills.slips(monthKey),
    queryFn: () => billRepository.slipComparison(monthKey),
    enabled: enabled && Boolean(monthKey),
  });
}

/**
 * Entering a printed figure, holding and releasing all move the comparison and the bill; a
 * release in a published month also publishes the bill, so the month and payouts move too.
 */
function useSlipMutation<Args extends unknown[], Result>(run: (...args: Args) => Promise<Result>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: Args) => run(...args),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.bills.all });
      void client.invalidateQueries({ queryKey: qk.months.all });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      void client.invalidateQueries({ queryKey: qk.audit.all });
    },
  });
}

export const useSetPrinted = () => useSlipMutation(billRepository.setPrinted);
export const useHoldBill = () => useSlipMutation(billRepository.hold);
export const useReleaseBill = () => useSlipMutation(billRepository.release);

export function useGenerateBills(monthKey: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => billRepository.generate(monthKey),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.bills.all });
      // Generating occupies the `billsGenerated` stage, so the month, the close checklist
      // and the dashboard's cycle badge all move with it.
      void client.invalidateQueries({ queryKey: qk.months.all });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      void client.invalidateQueries({ queryKey: qk.audit.all });
    },
  });
}

/** The largest page the API serves. */
const LAST_MONTH_PAGE = 200;

/**
 * Last month's bills, every page, as kilos by supplier (24 November 2026): the bills list
 * reads each row against it. A closed month does not change, so this is fetched once and
 * kept. An empty map (no bills that month) leaves the column blank, never an error.
 */
export function useLastMonthKgs(monthKey: string | undefined): {
  monthKey: string | undefined;
  kgs: Map<string, number>;
  isPending: boolean;
} {
  const previous = monthKey ? previousMonthKey(monthKey) : undefined;
  const pageQuery = (page: number): BillQuery => ({
    monthKey: previous,
    page,
    pageSize: LAST_MONTH_PAGE,
    sort: 'supplierCode',
    dir: 'asc',
  });
  const first = useQuery({
    queryKey: qk.bills.list(pageQuery(0)),
    queryFn: () => billRepository.list(pageQuery(0)),
    enabled: Boolean(previous),
    staleTime: 10 * 60_000,
    retry: false,
    throwOnError: false,
  });
  const pages = first.data ? Math.ceil(first.data.total / LAST_MONTH_PAGE) : 0;
  const rest = useQueries({
    queries: Array.from({ length: Math.max(0, pages - 1) }, (_, index) => ({
      queryKey: qk.bills.list(pageQuery(index + 1)),
      queryFn: () => billRepository.list(pageQuery(index + 1)),
      staleTime: 10 * 60_000,
      retry: false,
      throwOnError: false,
    })),
  });
  // Rebuilt only when a page arrives, so the grid's columns are not remade every render.
  const stamp = [first.dataUpdatedAt, ...rest.map((one) => one.dataUpdatedAt)].join(',');
  const kgs = useMemo(() => {
    const map = new Map<string, number>();
    for (const page of [first.data, ...rest.map((one) => one.data)]) {
      for (const row of page?.items ?? []) map.set(row.supplierId, row.totalKgs);
    }
    return map;
    // `stamp` changes exactly when any page's data does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
  return {
    monthKey: previous,
    kgs,
    isPending: first.isPending || rest.some((one) => one.isPending),
  };
}
