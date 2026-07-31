/**
 * M9 hooks.
 *
 * The decision mutation is where the invalidation matters most. Approving a
 * change request makes **four** things stale, and missing any one of them shows
 * the office something untrue:
 *
 *  - the queue (the row is decided and should leave the pending filter)
 *  - this request (its decision panel)
 *  - the supplier (AC-02: their active value has changed)
 *  - the dashboard (the sidebar badge and the queue card)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangeRequestQuery, DecisionBody } from '@tfd/domain';
import { changeRequestRepository } from '@/services/repositories/changeRequestRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';

export function useChangeRequests(query: ChangeRequestQuery) {
  return useQuery({
    queryKey: qk.changeRequests.list(query),
    queryFn: () => changeRequestRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useChangeRequest(id: string | undefined) {
  return useQuery({
    queryKey: qk.changeRequests.detail(id ?? ''),
    queryFn: () => changeRequestRepository.get(id!),
    enabled: Boolean(id),
  });
}

export function useChangeRequestAudit(id: string | undefined) {
  return useQuery({
    queryKey: qk.audit.forEntity('changeRequest', id ?? ''),
    queryFn: () => auditRepository.forEntity('changeRequest', id!),
    enabled: Boolean(id),
    throwOnError: false,
    retry: false,
  });
}

export type DecisionVerb = 'approve' | 'reject';

export function useDecideChangeRequest(id: string, supplierId: string | undefined) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ verb, body }: { verb: DecisionVerb; body: DecisionBody }) =>
      verb === 'approve'
        ? changeRequestRepository.approve(id, body)
        : changeRequestRepository.reject(id, body),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.changeRequests.detail(id) });
      void client.invalidateQueries({ queryKey: qk.changeRequests.all });
      void client.invalidateQueries({ queryKey: qk.audit.forEntity('changeRequest', id) });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      if (supplierId) {
        void client.invalidateQueries({ queryKey: qk.suppliers.detail(supplierId) });
        void client.invalidateQueries({ queryKey: qk.suppliers.all });
      }
    },

    onError: (error: unknown) => {
      // `already-decided` means our copy is stale — someone else worked the same
      // inbox. Refetch so the UI shows what they actually chose rather than
      // leaving the clerk staring at a row that no longer exists in that state.
      if (error && typeof error === 'object' && 'code' in error && error.code === 'already-decided') {
        void client.invalidateQueries({ queryKey: qk.changeRequests.detail(id) });
        void client.invalidateQueries({ queryKey: qk.changeRequests.all });
      }
    },
  });
}
