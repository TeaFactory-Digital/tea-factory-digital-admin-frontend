/**
 * M18 hooks.
 *
 * The invalidation set is deliberately **smaller** than M7's, and the difference is
 * the module's whole argument for existing separately. Deciding a credit request moves
 * `creditBalances`, which changes every other facility's headroom — so it has to sweep
 * the supplier and all three credit queues. Approving tea packets moves none of that:
 * it adds a line to the next bill and nothing to any ceiling.
 *
 * What it does invalidate is the supplier — the outstanding tea figure on their record
 * has changed — and the dashboard, whose sidebar badge counts this queue.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DecisionBody, TeaPacketRequestQuery } from '@tfd/domain';
import { teaPacketRepository } from '@/services/repositories/teaPacketRepository';
import { qk } from '@/query/queryKeys';

export function useTeaPacketRequests(query: TeaPacketRequestQuery) {
  return useQuery({
    queryKey: qk.teaPackets.list(query),
    queryFn: () => teaPacketRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export type DecisionVerb = 'approve' | 'reject';

export function useDecideTeaPacketRequest(id: string, supplierId: string | undefined) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ verb, body }: { verb: DecisionVerb; body: DecisionBody }) =>
      verb === 'approve'
        ? teaPacketRepository.approve(id, body)
        : teaPacketRepository.reject(id, body),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.teaPackets.all });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      if (supplierId) {
        void client.invalidateQueries({ queryKey: qk.suppliers.detail(supplierId) });
        void client.invalidateQueries({ queryKey: qk.suppliers.all });
      }
    },

    onError: (error: unknown) => {
      // Two clerks on one inbox is the normal case, not the edge case. Refetch so the
      // screen shows what the other one actually chose.
      if (error && typeof error === 'object' && 'code' in error && error.code === 'already-decided') {
        void client.invalidateQueries({ queryKey: qk.teaPackets.all });
      }
    },
  });
}
