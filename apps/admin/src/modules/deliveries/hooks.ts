/**
 * M3 queries and mutations.
 *
 * The invalidation set is the interesting part. Committing a weighing session
 * changes four things a clerk can see at once: the day's rows, the day's totals,
 * the dashboard's "today's leaf" card, and the registry's *last delivery* column.
 * Missing any one of them shows the office two numbers for the same fact thirty
 * seconds apart, which is how a data-entry screen loses the office's trust.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeliveryBatch, DeliveryQuery } from '@tfd/domain';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { qk } from '@/query/queryKeys';

export function useDeliveries(query: DeliveryQuery) {
  return useQuery({
    queryKey: qk.deliveries.list(query),
    queryFn: () => deliveryRepository.list(query),
    // A weighing session is entered against a list that must not blink between
    // pages; the previous page stays until the next one lands.
    placeholderData: (previous) => previous,
  });
}

/**
 * The day's totals, and whether the month will accept an entry at all.
 *
 * Its own query rather than a field on the list: the totals cover the whole day
 * and the list covers a page of it, and `locked` decides whether the screen may
 * offer an entry grid before the clerk types anything (BR-108).
 */
export function useDaySummary(date: string, collectionPoint?: string) {
  return useQuery({
    queryKey: qk.deliveries.day(date, collectionPoint),
    queryFn: () => deliveryRepository.day(date, collectionPoint),
  });
}

export function useCommitBatch() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (batch: DeliveryBatch) => deliveryRepository.commit(batch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.deliveries.all });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      // The registry's "last delivery" column is delivery data, so it is stale
      // the moment a session commits.
      void client.invalidateQueries({ queryKey: qk.suppliers.all });
    },
  });
}

export function useVoidDelivery() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      deliveryRepository.void(id, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.deliveries.all });
      void client.invalidateQueries({ queryKey: qk.dashboard });
      void client.invalidateQueries({ queryKey: qk.audit.all });
    },
  });
}
