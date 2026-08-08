/**
 * M11 banner queries and mutations.
 *
 * The same invalidation rule as the article half, for the same reason: **saving one
 * language invalidates the whole record**, because `missingLanguages` is derived from
 * every translation at once and writing the English copy changes what the other tabs
 * should say.
 *
 * One rule is this module's own. A publish, an unpublish or a window edit invalidates
 * the **list** as well as the record, because `BannerListItem.window` is computed from
 * the clock server-side — so the row that said `scheduled` a moment ago is the row that
 * now says `live`, and a screen that refreshed only the record it just saved would leave
 * the office looking at a stale answer to the one question they came here to ask.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BannerDraft,
  BannerPatch,
  BannerQuery,
  BannerTranslationBody,
  LanguageCode,
} from '@tfd/domain';
import { bannerRepository } from '@/services/repositories/bannerRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';

export function useBanners(query: BannerQuery) {
  return useQuery({
    queryKey: qk.banners.list(query),
    queryFn: () => bannerRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useBanner(id: string | undefined) {
  return useQuery({
    queryKey: qk.banners.detail(id ?? ''),
    queryFn: () => bannerRepository.get(id!),
    enabled: Boolean(id),
  });
}

export function useBannerPreview(id: string | undefined, lang: LanguageCode) {
  return useQuery({
    queryKey: qk.banners.preview(id ?? '', lang),
    queryFn: () => bannerRepository.preview(id!, lang),
    enabled: Boolean(id),
  });
}

export function useBannerAudit(id: string | undefined) {
  return useQuery({
    queryKey: qk.audit.forEntity('promoBanner', id ?? ''),
    queryFn: () => auditRepository.forEntity('promoBanner', id!),
    enabled: Boolean(id),
    // An editor has `content: W` and no `auditLog` grant (§12.1), so this 403s for the
    // person most likely to be on this screen. Not an error worth showing.
    throwOnError: false,
    retry: false,
  });
}

/** Everything a change to one banner makes stale. */
function useInvalidateBanner(id: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.banners.all });
    void client.invalidateQueries({ queryKey: qk.audit.forEntity('promoBanner', id) });
    void client.invalidateQueries({ queryKey: qk.audit.all });
  };
}

export function useCreateBanner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: BannerDraft) => bannerRepository.create(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.banners.all });
      void client.invalidateQueries({ queryKey: qk.audit.all });
    },
  });
}

export function useSaveBannerTranslation(id: string) {
  const invalidate = useInvalidateBanner(id);
  return useMutation({
    mutationFn: ({ lang, body }: { lang: LanguageCode; body: BannerTranslationBody }) =>
      bannerRepository.saveTranslation(id, lang, body),
    onSuccess: invalidate,
  });
}

export function usePatchBanner(id: string) {
  const invalidate = useInvalidateBanner(id);
  return useMutation({
    mutationFn: (body: BannerPatch) => bannerRepository.patch(id, body),
    onSuccess: invalidate,
  });
}

export type BannerLifecycleVerb = 'publish' | 'unpublish' | 'archive';

export function useBannerLifecycle(id: string) {
  const invalidate = useInvalidateBanner(id);
  return useMutation({
    mutationFn: (verb: BannerLifecycleVerb) =>
      verb === 'publish'
        ? bannerRepository.publish(id)
        : verb === 'unpublish'
          ? bannerRepository.unpublish(id)
          : bannerRepository.archive(id),
    onSuccess: invalidate,
  });
}
