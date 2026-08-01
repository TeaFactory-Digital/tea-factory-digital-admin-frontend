/**
 * M11 and M12 queries and mutations.
 *
 * One invalidation rule runs through all of it and is worth stating once: **saving one
 * language invalidates the whole record.** It is tempting to refresh only the language
 * that changed, and it would be wrong — `missingLanguages` and `staleLanguages` are
 * derived from every translation at once, so writing the English copy can make the
 * Sinhala one *stale without touching it*. A narrower invalidation would leave the tabs
 * showing the state before the edit, which is the exact failure AC-08 is written against.
 *
 * The preview is invalidated too, and for the same reason from the other direction: it is
 * the server's resolution of the fallback, so a save can change what a reader in an
 * untouched language gets.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ContentTranslationBody,
  LanguageCode,
  NewsArticleDraft,
  NewsArticlePatch,
  NewsQuery,
  StaticPageSlug,
} from '@tfd/domain';
import { newsRepository, staticPageRepository } from '@/services/repositories/contentRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';

/**
 * The languages **this factory** authors in.
 *
 * From `GET /config`, never from the platform's `SUPPORTED_LANGUAGES`: a factory that
 * sells in English and Tamil is not missing Sinhala, and offering it a Sinhala tab would
 * invent work and then report it as incomplete.
 */
export function useContentLanguages(): LanguageCode[] {
  const { config } = useRuntimeConfig();
  return config.localization.contentLanguages;
}

/* ────────────────────────────── M11 News ────────────────────────────── */

export function useNewsList(query: NewsQuery) {
  return useQuery({
    queryKey: qk.news.list(query),
    queryFn: () => newsRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useNewsArticle(id: string | undefined) {
  return useQuery({
    queryKey: qk.news.detail(id ?? ''),
    queryFn: () => newsRepository.get(id!),
    enabled: Boolean(id),
  });
}

export function useNewsPreview(id: string | undefined, lang: LanguageCode) {
  return useQuery({
    queryKey: qk.news.preview(id ?? '', lang),
    queryFn: () => newsRepository.preview(id!, lang),
    enabled: Boolean(id),
  });
}

export function useNewsAudit(id: string | undefined) {
  return useQuery({
    queryKey: qk.audit.forEntity('newsArticle', id ?? ''),
    queryFn: () => auditRepository.forEntity('newsArticle', id!),
    enabled: Boolean(id),
    // An editor has `content: W` and no `auditLog` grant at all (§12.1), so this 403s
    // for the person most likely to be on this screen. Not an error worth showing.
    throwOnError: false,
    retry: false,
  });
}

/** Everything a change to one article makes stale. */
function useInvalidateArticle(id: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.news.all });
    void client.invalidateQueries({ queryKey: qk.audit.forEntity('newsArticle', id) });
    void client.invalidateQueries({ queryKey: qk.audit.all });
  };
}

export function useCreateNewsArticle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: NewsArticleDraft) => newsRepository.create(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.news.all });
      void client.invalidateQueries({ queryKey: qk.audit.all });
    },
  });
}

export function useSaveNewsTranslation(id: string) {
  const invalidate = useInvalidateArticle(id);
  return useMutation({
    mutationFn: ({ lang, body }: { lang: LanguageCode; body: ContentTranslationBody }) =>
      newsRepository.saveTranslation(id, lang, body),
    onSuccess: invalidate,
  });
}

export function usePatchNewsArticle(id: string) {
  const invalidate = useInvalidateArticle(id);
  return useMutation({
    mutationFn: (body: NewsArticlePatch) => newsRepository.patch(id, body),
    onSuccess: invalidate,
  });
}

export type NewsLifecycleVerb = 'publish' | 'unpublish' | 'archive';

export function useNewsLifecycle(id: string) {
  const invalidate = useInvalidateArticle(id);
  return useMutation({
    mutationFn: (verb: NewsLifecycleVerb) =>
      verb === 'publish'
        ? newsRepository.publish(id)
        : verb === 'unpublish'
          ? newsRepository.unpublish(id)
          : newsRepository.archive(id),
    onSuccess: invalidate,
  });
}

/* ─────────────────────── M12 Static content ─────────────────────── */

export function useStaticPages() {
  return useQuery({
    queryKey: qk.staticPages.list,
    queryFn: () => staticPageRepository.list(),
  });
}

export function useStaticPagePreview(slug: StaticPageSlug | undefined, lang: LanguageCode) {
  return useQuery({
    queryKey: qk.staticPages.preview(slug ?? '', lang),
    queryFn: () => staticPageRepository.preview(slug!, lang),
    enabled: Boolean(slug),
  });
}

function useInvalidateStaticPages() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.staticPages.all });
    void client.invalidateQueries({ queryKey: qk.audit.all });
  };
}

export function useSaveStaticPageTranslation(slug: StaticPageSlug) {
  const invalidate = useInvalidateStaticPages();
  return useMutation({
    mutationFn: ({ lang, body }: { lang: LanguageCode; body: ContentTranslationBody }) =>
      staticPageRepository.saveTranslation(slug, lang, body),
    onSuccess: invalidate,
  });
}

export function usePublishStaticPage(slug: StaticPageSlug) {
  const invalidate = useInvalidateStaticPages();
  return useMutation({
    mutationFn: () => staticPageRepository.publish(slug),
    onSuccess: invalidate,
  });
}
