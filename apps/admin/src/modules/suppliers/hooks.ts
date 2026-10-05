/**
 * M2 hooks. Screens own data *fetching* through these; components stay
 * presentational (architecture.md §7).
 *
 * The invalidation is the interesting part. A supplier mutation makes three
 * things stale — the detail, every list that might contain the row, and the audit
 * trail for that record — and the centralized query keys are what make writing
 * that once possible.
 */

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminCreditRequest,
  AdminTeaPacketRequest,
  RequestStatus,
  SupplierQuery,
} from '@tfd/domain';
import { creditRepository } from '@/services/repositories/creditRepository';
import { teaPacketRepository } from '@/services/repositories/teaPacketRepository';
import { isApiError } from '@/services/api/errors';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';

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

/**
 * One supplier's months.
 *
 * `year` is `undefined` on first render and the **server** resolves it to the newest
 * year with data. Working that out here would mean fetching the history to discover
 * which year to ask for, which is the round trip the `years` field exists to avoid.
 */
/** One supplier's savings passbook, oldest first. Read only. */
export function useSupplierSavingsLedger(id: string | undefined) {
  return useQuery({
    queryKey: qk.savings.ledger(id ?? ''),
    queryFn: () => supplierRepository.savingsLedger(id!),
    enabled: Boolean(id),
    // `403 feature-disabled` when the factory does not run a savings scheme: not a
    // failure to retry, and the screen hides the passbook.
    retry: false,
  });
}

export function useSupplierIncome(id: string | undefined, year: number | undefined) {
  return useQuery({
    queryKey: qk.suppliers.income(id ?? '', year),
    queryFn: () => supplierRepository.income(id!, year),
    enabled: Boolean(id),
    // Moving the year picker should not blank the chart while the next year loads.
    placeholderData: (previous) => previous,
  });
}

/**
 * Why a push would or would not reach this supplier.
 *
 * `throwOnError: false` like the audit panel: this reads the device registry, and a
 * role that may see a supplier but not their devices should get no panel rather than
 * an error banner across the record.
 */
export function useSupplierNotifications(id: string | undefined) {
  const { config } = useRuntimeConfig();
  const offered = config.push?.categories;
  return useQuery({
    queryKey: qk.suppliers.notifications(id ?? ''),
    queryFn: () => supplierRepository.notifications(id!, offered),
    enabled: Boolean(id),
    throwOnError: false,
    retry: false,
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

/**
 * Issue a new app password (§21.16).
 *
 * Invalidates the supplier, because the reset sets `owesPasswordChange` and stamps
 * `lastPasswordResetAt` — a detail page still showing neither would be showing a record
 * that is one request out of date, on the one screen where a pattern of resets is visible.
 */
export function useResetSupplierCredentials(supplierId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => supplierRepository.resetCredentials(supplierId, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.suppliers.detail(supplierId) });
      void client.invalidateQueries({ queryKey: qk.audit.all });
    },
  });
}

const HISTORY_STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected'];
/** The largest page the queues serve. A supplier with more is shown the latest this many. */
const HISTORY_PAGE = 100;

export interface SupplierRequestHistory {
  credit: AdminCreditRequest[];
  teaPackets: AdminTeaPacketRequest[];
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Every advance, loan, manure and tea packet request one supplier has made, in any status.
 *
 * Read from the two queues, once per status (they answer one status at a time), with
 * `supplierId`. **Also filtered here by supplier**, because the API ignored that filter and
 * returned every supplier's rows (BACKEND-TODO #28): without this, a supplier's history
 * showed other people's requests. Once the API filters, this changes nothing.
 *
 * Tea packets answer `403 feature-disabled` for a factory that does not sell them; that is
 * an empty list, not an error.
 */
export function useSupplierRequestHistory(supplierId: string | undefined): SupplierRequestHistory {
  const enabled = Boolean(supplierId);
  const credit = useQueries({
    queries: HISTORY_STATUSES.map((status) => {
      const query = { status, supplierId, page: 0, pageSize: HISTORY_PAGE };
      return {
        queryKey: qk.credit.list(query),
        queryFn: () => creditRepository.list(query),
        enabled,
      };
    }),
  });
  const tea = useQueries({
    queries: HISTORY_STATUSES.map((status) => {
      const query = { status, supplierId, page: 0, pageSize: HISTORY_PAGE };
      return {
        queryKey: qk.teaPackets.list(query),
        queryFn: () => teaPacketRepository.list(query),
        enabled,
        retry: false,
      };
    }),
  });

  const teaDisabled = tea.some(
    (one) => isApiError(one.error) && one.error.code === 'feature-disabled',
  );
  const mine = <T extends { supplierId: string; createdAt: string }>(rows: T[]) =>
    rows
      .filter((row) => row.supplierId === supplierId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    credit: mine(credit.flatMap((one) => one.data?.items ?? [])),
    teaPackets: teaDisabled ? [] : mine(tea.flatMap((one) => one.data?.items ?? [])),
    isPending:
      credit.some((one) => one.isPending) || (!teaDisabled && tea.some((one) => one.isPending)),
    error:
      credit.find((one) => one.error)?.error ??
      (teaDisabled ? undefined : tea.find((one) => one.error)?.error),
    refetch: () => {
      credit.forEach((one) => void one.refetch());
      tea.forEach((one) => void one.refetch());
    },
  };
}
