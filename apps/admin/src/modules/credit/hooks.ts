/**
 * M7 hooks.
 *
 * The invalidation here is wider than M9's by one entry, and the extra one is the
 * whole reason this module is harder than it looks: approving credit changes the
 * **supplier**. An approved advance becomes a `creditBalances.advance` balance, the
 * next eligibility read subtracts it from the ceiling, and the next bill deducts an
 * instalment against it (§11.3). A cache that kept the old supplier record would go
 * on offering headroom the office has already lent.
 *
 * So a decision makes five things stale:
 *
 *  - this request (its decision panel and its frozen figures)
 *  - the queue (the row leaves the pending filter)
 *  - **every other credit row for that supplier** — their ceilings just moved
 *  - the supplier (M2's detail, their credit balances)
 *  - the dashboard (the sidebar badge and three queue cards)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreditDecisionBody, CreditRequestQuery } from '@tfd/domain';
import { creditRepository } from '@/services/repositories/creditRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';

export function useCreditRequests(query: CreditRequestQuery) {
  return useQuery({
    queryKey: qk.credit.list(query),
    queryFn: () => creditRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useCreditRequest(id: string | undefined) {
  return useQuery({
    queryKey: qk.credit.detail(id ?? ''),
    queryFn: () => creditRepository.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreditRequestAudit(id: string | undefined) {
  return useQuery({
    queryKey: qk.audit.forEntity('creditRequest', id ?? ''),
    queryFn: () => auditRepository.forEntity('creditRequest', id!),
    enabled: Boolean(id),
    throwOnError: false,
    retry: false,
  });
}

export type CreditVerb = 'approve' | 'reject';

export interface CreditDecisionVariables {
  verb: CreditVerb;
  body: CreditDecisionBody;
  /** Checked client-side before an approval leaves. See `creditRepository`. */
  check: { amount: number; available: number };
}

export function useDecideCreditRequest(id: string, supplierId: string | undefined) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ verb, body, check }: CreditDecisionVariables) =>
      verb === 'approve'
        ? creditRepository.approve(id, body, check)
        : creditRepository.reject(id, body),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.credit.detail(id) });
      // The whole module, not this row: an approval moved the supplier's balance,
      // and their *other* pending facilities are priced against it.
      void client.invalidateQueries({ queryKey: qk.credit.all });
      void client.invalidateQueries({ queryKey: qk.audit.forEntity('creditRequest', id) });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      if (supplierId) {
        void client.invalidateQueries({ queryKey: qk.suppliers.detail(supplierId) });
        void client.invalidateQueries({ queryKey: qk.suppliers.all });
      }
    },

    onError: (error: unknown) => {
      if (!error || typeof error !== 'object' || !('code' in error)) return;

      /**
       * Two refusals mean "your copy is out of date", and both are fixed by
       * refetching rather than by the clerk doing anything differently:
       * `already-decided` (somebody else worked the row) and `stale-eligibility`
       * (the ceiling moved). Pulling the fresh figures in immediately means the
       * dialog's explanation sits next to the number that is now true.
       */
      if (error.code === 'already-decided' || error.code === 'stale-eligibility') {
        void client.invalidateQueries({ queryKey: qk.credit.detail(id) });
        void client.invalidateQueries({ queryKey: qk.credit.all });
      }
    },
  });
}
