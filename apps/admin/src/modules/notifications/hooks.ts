/**
 * M13 queries and mutations.
 *
 * The unusual one is `useNotificationReach`: a **query keyed on a draft**, refetched as
 * the composer changes the category or the audience. It looks like state that belongs in
 * the dialog and is not — the reach is the server's answer about consent it holds and the
 * console does not, and it is the figure the send decision turns on.
 *
 * Everything else invalidates `notifications.all`, including a trigger change that
 * touches no send: the log and the triggers are read side by side, and a factory that has
 * just turned `newsArticle` on wants the next publish to appear underneath it.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ComposeNotificationBody,
  NotificationAudience,
  NotificationCategory,
  NotificationQuery,
} from '@tfd/domain';
import { notificationRepository } from '@/services/repositories/notificationRepository';
import { qk } from '@/query/queryKeys';

export function useNotifications(query: NotificationQuery) {
  return useQuery({
    queryKey: qk.notifications.list(query),
    queryFn: () => notificationRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

/**
 * `throwOnError: false` and no retry, because **M10 reads this too**.
 *
 * A clerk answering an inquiry holds `inquiries: A` and may hold no `content` grant at
 * all, so this 403s for the person most likely to be on that screen. An unanswerable
 * question is not an error worth surfacing there — the inquiry detail treats it as "no
 * push", which is the safer of the two wrong answers.
 */
export function useNotificationTriggers() {
  return useQuery({
    queryKey: qk.notifications.triggers,
    queryFn: () => notificationRepository.triggers(),
    throwOnError: false,
    retry: false,
  });
}

/**
 * How far the send being composed would reach.
 *
 * `enabled` on a complete audience only — a half-filled form ("collection point", none
 * chosen) would otherwise ask the server a question whose honest answer is *everybody*,
 * and the composer would flash the whole-factory figure while somebody is still choosing.
 */
export function useNotificationReach(
  category: NotificationCategory,
  audience: NotificationAudience,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['notifications', 'reach', category, audience] as const,
    queryFn: () => notificationRepository.reach(category, audience),
    enabled,
    // Keep the last figures while the next arrive: a number that blanks on every
    // keystroke is a number nobody reads.
    placeholderData: keepPreviousData,
  });
}

function useInvalidateNotifications() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.notifications.all });
    void client.invalidateQueries({ queryKey: qk.audit.all });
  };
}

export function useSetNotificationTrigger() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: ({ category, enabled }: { category: NotificationCategory; enabled: boolean }) =>
      notificationRepository.setTrigger(category, enabled),
    onSuccess: invalidate,
  });
}

export function useSendNotification() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (body: ComposeNotificationBody) => notificationRepository.send(body),
    onSuccess: invalidate,
  });
}
