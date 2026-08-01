/**
 * M2 hooks. Screens own data *fetching* through these; components stay
 * presentational (architecture.md §7).
 *
 * The invalidation is the interesting part. A supplier mutation makes three
 * things stale — the detail, every list that might contain the row, and the audit
 * trail for that record — and the centralized query keys are what make writing
 * that once possible.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupplierEditable, SupplierQuery } from '@tfd/domain';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';

/**
 * `enabled` is here for M3's code lookup, which must not search on an empty box:
 * the first keystroke of a supplier code would otherwise ask the server for the
 * whole registry, on the connection the weighing point is sharing.
 */
export function useSuppliers(query: SupplierQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.suppliers.list(query),
    queryFn: () => supplierRepository.list(query),
    enabled: options.enabled ?? true,
    // Keeps the previous page on screen while the next loads, so paging does not
    // flash an empty grid — the single biggest perceived-speed win in a data table.
    placeholderData: (previous) => previous,
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: qk.suppliers.detail(id ?? ''),
    queryFn: () => supplierRepository.get(id!),
    enabled: Boolean(id),
  });
}

export function useSupplierAudit(id: string | undefined) {
  return useQuery({
    queryKey: qk.audit.forEntity('supplier', id ?? ''),
    queryFn: () => auditRepository.forEntity('supplier', id!),
    enabled: Boolean(id),
    // A clerk without audit access sees no panel rather than an error — the
    // §12.1 matrix gives `auditLog` to accountant and above only.
    throwOnError: false,
    retry: false,
  });
}

function useInvalidateSupplier(id: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.suppliers.detail(id) });
    void client.invalidateQueries({ queryKey: qk.suppliers.all });
    void client.invalidateQueries({ queryKey: qk.audit.forEntity('supplier', id) });
  };
}

export function useUpdateSupplier(id: string) {
  const invalidate = useInvalidateSupplier(id);
  return useMutation({
    mutationFn: (body: Partial<SupplierEditable>) => supplierRepository.update(id, body),
    onSuccess: invalidate,
  });
}

export function useSuspendSupplier(id: string) {
  const invalidate = useInvalidateSupplier(id);
  return useMutation({
    mutationFn: (reason: string) => supplierRepository.suspend(id, reason),
    onSuccess: invalidate,
  });
}

export function useReactivateSupplier(id: string) {
  const invalidate = useInvalidateSupplier(id);
  return useMutation({
    mutationFn: (reason: string) => supplierRepository.reactivate(id, reason),
    onSuccess: invalidate,
  });
}

/**
 * The audited reveal.
 *
 * **No `onSuccess` invalidation and no cache entry.** The full account number is
 * held by the dialog that asked for it and dropped when it closes; putting it in
 * the query cache would leave it in memory for the session, readable by any
 * component that guessed the key.
 *
 * The audit trail *is* invalidated, so the entry the reveal produced appears in
 * the panel below — which is the point of auditing it where the clerk can see.
 */
export function useRevealBankDetails(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => supplierRepository.revealBankDetails(id, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.audit.forEntity('supplier', id) });
    },
    gcTime: 0,
  });
}
