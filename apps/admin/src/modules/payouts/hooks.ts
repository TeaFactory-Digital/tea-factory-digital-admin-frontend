/**
 * M6 queries and mutations.
 *
 * Every mutation invalidates `payouts.all` rather than one key, and the reason is
 * arithmetic: a run's counts and totals are **derived from its lines**, so marking
 * one line paid changes the header above the grid. Invalidating only the line list
 * would leave a run reading "3 of 40 paid" over a grid showing four.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaymentMethod, PayoutLineMark, PayoutLineQuery, PayoutRunQuery } from '@tfd/domain';
import { payoutRepository } from '@/services/repositories/payoutRepository';
import { qk } from '@/query/queryKeys';

export function usePayoutRuns(query: PayoutRunQuery) {
  return useQuery({
    queryKey: qk.payouts.list(query),
    queryFn: () => payoutRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export function usePayoutRun(id: string | undefined) {
  return useQuery({
    queryKey: qk.payouts.detail(id ?? ''),
    queryFn: () => payoutRepository.get(id!),
    enabled: Boolean(id),
  });
}

export function usePayoutLines(id: string | undefined, query: PayoutLineQuery) {
  return useQuery({
    queryKey: qk.payouts.lines(id ?? '', query),
    queryFn: () => payoutRepository.lines(id!, query),
    enabled: Boolean(id),
    placeholderData: (previous) => previous,
  });
}

/** What a run-level change makes stale. The audit trail is always one of them. */
function useInvalidatePayouts() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.payouts.all });
    void client.invalidateQueries({ queryKey: qk.audit.all });
  };
}

export function useCreatePayoutRun() {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: ({ monthKey, method }: { monthKey: string; method: PaymentMethod }) =>
      payoutRepository.create(monthKey, method),
    onSuccess: invalidate,
  });
}

export function useApprovePayoutRun(id: string) {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: (note?: string) => payoutRepository.approve(id, note),
    onSuccess: invalidate,
  });
}

export function useMarkPayoutLine(id: string) {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: ({ lineId, ...body }: PayoutLineMark & { lineId: string }) =>
      payoutRepository.mark(id, lineId, body),
    onSuccess: invalidate,
  });
}
