/**
 * M11 and M12 gateway.
 *
 * One repository for both, which is the exception to this layer's one-per-module rule
 * and worth the exception: an article and a static page differ in their **lifecycle**,
 * not in their copy. The validation that matters — a translation is only saved when it
 * actually says something — is identical, and two copies of it would be two places for
 * the AC-08 guard to drift.
 *
 * The guards here are the console's half. The server refuses all of this too and is the
 * authority (§9.3); these exist so the editor is told under the field they are typing in
 * rather than after a round trip.
 */

import {
  EDITORIAL_FALLBACK_LANGUAGE,
  contentTranslationSchema,
  newsArticleDraftSchema,
  type AdminNewsArticle,
  type AdminStaticPage,
  type ContentPreview,
  type ContentTranslationBody,
  type LanguageCode,
  type NewsArticleDraft,
  type NewsListItem,
  type NewsPatch,
  type NewsQuery,
  type Paged,
  type StaticPageSlug,
} from '@tfd/domain';
import { newsEndpoints, type CreatedArticle } from '../endpoints/news';
import { staticPageEndpoints } from '../endpoints/staticPages';
import { toContentPreview, type MutationAck, type StatusAck } from '../api/adapters';
import { ApiError } from '../api/errors';

/**
 * Refuse a translation that says nothing, before it leaves the browser.
 *
 * The failure it prevents: an editor opens the Sinhala tab, types nothing, saves, and the
 * record now reports Sinhala as **written**. The gap disappears from the very list AC-08
 * requires it to appear in, and a supplier gets a blank article. Refusing the save is the
 * only version of this that does not lose information.
 */
function parseTranslation(body: ContentTranslationBody): ContentTranslationBody {
  const parsed = contentTranslationSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'note-required',
      message: 'A translation needs a title and a body.',
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

export const newsRepository = {
  list: (query: NewsQuery = {}): Promise<Paged<NewsListItem>> =>
    newsEndpoints.list({ page: 0, pageSize: 25, ...query }),

  /**
   * **`updatedAt` / `updatedByName` are worked out here.**
   *
   * `GET /admin/news/:id` does not send them at the article level, so the heading read
   * "Last edited by , —". Each translation carries its own, and the article's last edit is
   * simply the newest of those: the same rule `AdminNewsArticle.updatedAt` documents. An
   * article with no translation yet falls back to who created it and when.
   */
  get: async (id: string): Promise<AdminNewsArticle> => {
    const served = (await newsEndpoints.get(id)) as AdminNewsArticle &
      Partial<Pick<AdminNewsArticle, 'updatedAt' | 'updatedByName'>>;
    const newest = Object.values(served.translations ?? {})
      .filter((one) => one?.updatedAt)
      .sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt))[0];
    return {
      ...served,
      updatedAt: served.updatedAt ?? newest?.updatedAt ?? served.createdAt,
      updatedByName: served.updatedByName ?? newest?.updatedByName ?? served.createdByName,
    };
  },

  create: async (body: NewsArticleDraft): Promise<CreatedArticle> => {
    const parsed = newsArticleDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError({
        // The console's own spelling of the server's refusal, so the screen has one
        // error path whether the gap was caught here or by the API.
        code: 'fallback-translation-missing',
        message: 'An article needs its English copy before it can exist.',
        details: parsed.error.flatten(),
      });
    }
    /**
     * The **fallback language's copy travels flat**, not in a `translations` array.
     *
     * `POST /admin/news` reads `title`, `excerpt`, `body` and the cover image off the top
     * level and writes them as the English translation; it has no `translations` field.
     * Sending the array alone means `title` and `body` never arrive and the API answers
     * `422 invalid` — which is at least loud, unlike the same mismatch on banners, where
     * zod stripped the array and created a banner with no copy at all.
     *
     * The other languages are saved afterwards through `saveTranslation`, one at a time,
     * which is how the editor writes them anyway.
     */
    const draft = parsed.data as NewsArticleDraft;
    const fallback =
      draft.translations.find((one) => one.lang === EDITORIAL_FALLBACK_LANGUAGE) ??
      draft.translations[0]!;

    return newsEndpoints.create({
      coverImageAttachmentId: draft.coverImageAttachmentId,
      title: fallback.title,
      excerpt: fallback.excerpt,
      body: fallback.body,
    });
  },

  /**
   * The cover image, after creation.
   *
   * This did not exist, and its absence was a real hole rather than a simplification:
   * `ContentTranslationBody` has no image field, so once an article was created its
   * cover could never be changed. Copy still moves through `saveTranslation` and the
   * lifecycle through the three verbs below, because neither of those is this.
   *
   * Omit a field to leave it alone; `null` removes.
   */
  patch: (id: string, body: NewsPatch): Promise<MutationAck> => newsEndpoints.patch(id, body),

  /**

  /**
   * `async`, so the guard **rejects** rather than throwing synchronously.
   *
   * Not a style choice. A plain arrow calling `parseTranslation(body)` in the argument
   * position throws before a promise exists, so a caller writing `.catch()` — which is
   * how every screen in this console handles a refusal — gets an uncaught exception
   * instead. Every sibling repository is `async` for the same reason; this one was not,
   * and the content suite is what caught it.
   */
  saveTranslation: async (
    id: string,
    lang: LanguageCode,
    body: ContentTranslationBody,
  ): Promise<MutationAck> => newsEndpoints.saveTranslation(id, lang, parseTranslation(body)),

  preview: (id: string, lang: LanguageCode): Promise<ContentPreview> =>
    newsEndpoints.preview(id, lang).then(toContentPreview),

  publish: (id: string): Promise<StatusAck> => newsEndpoints.publish(id),
  schedule: (id: string, publishAt: string) => newsEndpoints.schedule(id, publishAt),
  cancelSchedule: (id: string) => newsEndpoints.cancelSchedule(id),
  unpublish: (id: string): Promise<StatusAck> => newsEndpoints.unpublish(id),
  archive: (id: string): Promise<StatusAck> => newsEndpoints.archive(id),
};

export const staticPageRepository = {
  list: (): Promise<AdminStaticPage[]> => staticPageEndpoints.list(),

  /**
   * One page, taken from the list of six.
   *
   * There is no `GET /admin/static-pages/{slug}` (gap **G-07**) and there does not need
   * to be: the closed set is small enough that fetching all of it is cheaper than a
   * second endpoint, and `list` already answers with the unwritten pages too — which a
   * per-slug fetch would have to decide how to represent.
   */
  get: async (slug: StaticPageSlug): Promise<AdminStaticPage> => {
    const found = (await staticPageEndpoints.list()).find((page) => page.slug === slug);
    if (!found) {
      throw new ApiError({
        code: 'not-found',
        message: 'That page is not one this factory has.',
        details: { entity: 'staticPage', slug },
      });
    }
    return found;
  },

  /** `async` for the reason `newsRepository.saveTranslation` is — the guard must reject. */
  saveTranslation: async (
    slug: StaticPageSlug,
    lang: LanguageCode,
    body: ContentTranslationBody,
  ): Promise<MutationAck> =>
    staticPageEndpoints.saveTranslation(slug, lang, parseTranslation(body)),

  preview: (slug: StaticPageSlug, lang: LanguageCode): Promise<ContentPreview> =>
    staticPageEndpoints.preview(slug, lang).then(toContentPreview),

  publish: (slug: StaticPageSlug): Promise<StatusAck> => staticPageEndpoints.publish(slug),

  /** The default text, or `null` when the server has none for it (or no such endpoint yet). */
  defaultText: async (
    slug: StaticPageSlug,
    lang: LanguageCode,
  ): Promise<{ title: string; body: string } | null> => {
    try {
      const served = await staticPageEndpoints.defaultText(slug, lang);
      return { title: served.title, body: served.body };
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'not-found' || error.status === 404)) {
        return null;
      }
      throw error;
    }
  },
};
