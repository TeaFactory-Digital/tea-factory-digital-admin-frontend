/**
 * Saving the factory's records, kept here while the factory-system sync is off.
 *
 * Each save refreshes what it changes. An import refreshes the lists of its kind, because a
 * file of two hundred weighings changes every day summary and month total those rows touch.
 */

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  BillAdjustment,
  ImportKind,
  ImportRow,
  NewSupplier,
  OpeningBalances,
  SupplierTransportRate,
  WalkInCreditRequest,
} from '@tfd/domain';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { qk } from '@/query/queryKeys';

/** What each import changes. The audit trail and the dashboard move with every one. */
const IMPORT_REFRESHES: Record<ImportKind, QueryKey[]> = {
  suppliers: [qk.suppliers.all],
  deliveries: [qk.deliveries.all, qk.months.all],
  monthlyRates: [qk.months.all],
  openingBalances: [qk.suppliers.all],
  walkInCredit: [qk.credit.all],
  billAdjustments: [qk.bills.all],
  transportRates: [qk.suppliers.all],
};

function useRefresh() {
  const client = useQueryClient();
  return (keys: QueryKey[]) => {
    for (const key of [...keys, qk.dashboard, qk.audit.all]) {
      void client.invalidateQueries({ queryKey: key });
    }
  };
}

export function useImportRows(kind: ImportKind) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ fileName, rows }: { fileName: string; rows: ImportRow[] }) =>
      factoryRecordRepository.importRows(kind, fileName, rows),
    onSuccess: (result) => {
      if (result.saved > 0) refresh(IMPORT_REFRESHES[kind]);
    },
  });
}

export function useCreateSupplier() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: NewSupplier) => factoryRecordRepository.createSupplier(body),
    onSuccess: () => refresh([qk.suppliers.all]),
  });
}

export function useOpeningBalances(supplierId: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.suppliers.openingBalances(supplierId),
    queryFn: () => factoryRecordRepository.openingBalances(supplierId),
    enabled,
  });
}

export function useSaveOpeningBalances(supplierId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: OpeningBalances & { note: string }) =>
      factoryRecordRepository.saveOpeningBalances(supplierId, body),
    onSuccess: () => refresh([qk.suppliers.openingBalances(supplierId), qk.suppliers.detail(supplierId)]),
  });
}

export function useSaveTransportRate(supplierId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: SupplierTransportRate) =>
      factoryRecordRepository.saveTransportRate(supplierId, body),
    onSuccess: () => refresh([qk.suppliers.detail(supplierId)]),
  });
}

export function useCreateWalkInCredit() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: WalkInCreditRequest) => factoryRecordRepository.createWalkInCredit(body),
    onSuccess: () => refresh([qk.credit.all, qk.suppliers.all]),
  });
}

export function useAdjustBill(billId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: BillAdjustment) => factoryRecordRepository.adjustBill(billId, body),
    onSuccess: () => refresh([qk.bills.all, qk.months.all]),
  });
}
