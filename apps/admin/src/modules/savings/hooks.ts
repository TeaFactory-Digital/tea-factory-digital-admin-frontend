/**
 * M8 queries. There are no mutations, and that is the module.
 *
 * A savings contribution is created by publishing a month (M4), and a savings *rate*
 * is changed by deciding a change request (M9). Both already carry the four-eyes
 * rule and the audit trail. A write path here would be a third way to move the same
 * money, with neither.
 */

import { useQuery } from '@tanstack/react-query';
import type { SavingsAccountQuery } from '@tfd/domain';
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
