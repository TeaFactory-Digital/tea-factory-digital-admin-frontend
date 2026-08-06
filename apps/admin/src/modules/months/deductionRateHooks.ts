/**
 * §21.10's rates: one query, one proposal, one decision.
 *
 * In M4's module rather than M14's because the capability is `ratesAndMonthClose` and the
 * shape is M4's — proposed by the accountant, approved by the manager, four eyes between.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeductionRates } from '@tfd/domain';
import { deductionRateRepository } from '@/services/repositories/deductionRateRepository';
import { qk } from '@/query/queryKeys';

export function useDeductionRates() {
  return useQuery({
    queryKey: qk.deductionRates,
    queryFn: () => deductionRateRepository.get(),
  });
}

/** An approved change alters every bill the next run produces, so M5 is swept too. */
function invalidate(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: qk.deductionRates });
  void client.invalidateQueries({ queryKey: qk.bills.all });
  void client.invalidateQueries({ queryKey: qk.audit.all });
}

export function useProposeDeductionRates() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ rates, reason }: { rates: DeductionRates; reason: string }) =>
      deductionRateRepository.propose(rates, reason),
    onSuccess: () => invalidate(client),
  });
}

export function useDecideDeductionRates() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verb, note }: { id: string; verb: 'approve' | 'reject'; note?: string }) =>
      deductionRateRepository.decide(id, verb, note),
    onSuccess: () => invalidate(client),
  });
}
