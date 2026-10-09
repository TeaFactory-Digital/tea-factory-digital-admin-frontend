import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityRepository } from '@/services/repositories/activityRepository';
import { qk } from '@/query/queryKeys';

/** How many recent items the bell lists. The rest are in the queues and the audit log. */
export const ACTIVITY_LIMIT = 20;

export function useActivity() {
  return useQuery({
    queryKey: qk.activity,
    queryFn: () => activityRepository.feed(ACTIVITY_LIMIT),
    // As often as the sidebar's badges, and never taking the shell down with it.
    refetchInterval: 60_000,
    staleTime: 30_000,
    throwOnError: false,
  });
}

export function useMarkActivityRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (upTo: string) => activityRepository.markRead(upTo),
    onSuccess: () => void client.invalidateQueries({ queryKey: qk.activity }),
  });
}
