/**
 * M8 queries, and the two mutations §21.9's answer added.
 *
 * A savings *contribution* is still created only by publishing a month (M4), and a savings
 * *rate* only by deciding a change request (M9) — both already carry four eyes and an audit
 * trail, and a third write path for either would have neither.
 *
 * A **withdrawal** is different, and the mutations below are deliberately not a third path
 * to the balance: they record a request, and the balance moves when the bill that pays it is
 * published. So the ledger still has exactly one source, which is what keeps a passbook and
 * a Green Leaf Account from disagreeing.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavingsAccountQuery, SavingsWithdrawalState } from '@tfd/domain';
import { savingsRepository } from '@/services/repositories/savingsRepository';
import { qk } from '@/query/queryKeys';

export function useSavingsSummary(monthKey?: string) {
  return useQuery({
    queryKey: qk.savings.summary(monthKey),
    queryFn: () => savingsRepository.summary(monthKey),
  });
}

export function useSavingsAccounts(query: SavingsAccountQuery) {
  return useQuery({
    queryKey: qk.savings.accounts(query),
    queryFn: () => savingsRepository.accounts(query),
    placeholderData: (previous) => previous,
  });
}

export function useSavingsLedger(supplierId: string | undefined) {
  return useQuery({
    queryKey: qk.savings.ledger(supplierId ?? ''),
    queryFn: () => savingsRepository.ledger(supplierId!),
    enabled: Boolean(supplierId),
  });
}

/**
 * The scheme's rules and this supplier's requests.
 *
 * Fetched per supplier rather than held with the account row, because the window depends on
 * the factory's Colombo-local month and on what is already pending — neither of which the
 * accounts grid knows, and both of which the refusal is written against.
 */
export function useSavingsWithdrawals(supplierId: string | undefined) {
  return useQuery({
    queryKey: qk.savings.withdrawals(supplierId ?? ''),
    queryFn: () => savingsRepository.withdrawals(supplierId!),
    enabled: Boolean(supplierId),
  });
}

/** Everything a withdrawal touches: its own list, the passbook beside it, and the audit. */
function invalidateWithdrawal(client: ReturnType<typeof useQueryClient>, supplierId: string) {
  void client.invalidateQueries({ queryKey: qk.savings.withdrawals(supplierId) });
  void client.invalidateQueries({ queryKey: qk.savings.ledger(supplierId) });
  void client.invalidateQueries({ queryKey: qk.savings.all });
  void client.invalidateQueries({ queryKey: qk.audit.all });
}

export function useRequestWithdrawal(supplierId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      amount,
      reason,
      context,
    }: {
      amount: number;
      reason: string;
      context: SavingsWithdrawalState;
    }) => savingsRepository.requestWithdrawal(supplierId, amount, reason, context),
    onSuccess: () => invalidateWithdrawal(client, supplierId),
  });
}

export function useCancelWithdrawal(supplierId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      savingsRepository.cancelWithdrawal(id, reason),
    onSuccess: () => invalidateWithdrawal(client, supplierId),
  });
}
