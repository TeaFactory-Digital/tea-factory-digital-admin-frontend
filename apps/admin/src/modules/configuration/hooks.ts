/**
 * M14 queries and the one mutation.
 *
 * The invalidation here is the widest in the console, and it has to be: a config save can
 * turn a module off. `qk.config` is what `RuntimeConfigProvider` reads, so invalidating it
 * is what makes the sidebar lose a row, the theme change colour, and M11's language tabs
 * appear or disappear — **without a reload**. A mutation that only refreshed this screen
 * would leave an administrator looking at a saved form beside a sidebar that still offers
 * the feature they just removed.
 *
 * Everything downstream of a flag is swept too. That looks heavy-handed and is not: the
 * alternative is enumerating which modules each of ten flags gates, in a second place,
 * where it would drift from `navigation.ts`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfigPatch } from '@tfd/domain';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { qk } from '@/query/queryKeys';

export function useAdminConfig() {
  return useQuery({
    queryKey: qk.adminConfig,
    queryFn: () => adminConfigRepository.get(),
  });
}

export function useSaveConfig() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      patch,
      config,
      usage,
    }: {
      patch: ConfigPatch;
      config: Parameters<typeof adminConfigRepository.patch>[1];
      usage: Parameters<typeof adminConfigRepository.patch>[2];
    }) => adminConfigRepository.patch(patch, config, usage),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.adminConfig });
      /**
       * The public config, which is what the whole console is branded and gated from.
       *
       * `RuntimeConfigProvider` holds it, so this is the line that makes a flag change
       * visible in the sidebar rather than after a refresh.
       */
      void client.invalidateQueries({ queryKey: qk.config });
      void client.invalidateQueries({ queryKey: qk.audit.all });
      // A flag change alters what the dashboard shows a queue for (AC-07), and the content
      // languages change what M11/M12 count as a gap (AC-08).
      void client.invalidateQueries({ queryKey: qk.dashboard });
      void client.invalidateQueries({ queryKey: qk.news.all });
      void client.invalidateQueries({ queryKey: qk.staticPages.all });
      void client.invalidateQueries({ queryKey: qk.notifications.all });
    },
  });
}
