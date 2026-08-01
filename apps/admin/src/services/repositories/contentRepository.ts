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
  contentTranslationSchema,
  newsArticleDraftSchema,
  type AdminNewsArticle,
  type AdminStaticPage,
  type ContentPreview,
  type ContentTranslationBody,
  type LanguageCode,
  type NewsArticleDraft,
  type NewsArticlePatch,
  type NewsListItem,
  type NewsQuery,
  type Paged,
  type StaticPageSlug,
} from '@tfd/domain';
import { newsEndpoints } from '../endpoints/news';
import { staticPageEndpoints } from '../endpoints/staticPages';
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

  get: (id: string): Promise<AdminNewsArticle> => newsEndpoints.get(id),

  create: async (body: NewsArticleDraft): Promise<AdminNewsArticle> => {
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
    return newsEndpoints.create(parsed.data as NewsArticleDraft);
  },

  patch: (id: string, body: NewsArticlePatch): Promise<AdminNewsArticle> =>
    newsEndpoints.patch(id, body),

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
  ): Promise<AdminNewsArticle> => newsEndpoints.saveTranslation(id, lang, parseTranslation(body)),

  preview: (id: string, lang: LanguageCode): Promise<ContentPreview> =>
    newsEndpoints.preview(id, lang),

  publish: (id: string): Promise<AdminNewsArticle> => newsEndpoints.publish(id),
  unpublish: (id: string): Promise<AdminNewsArticle> => newsEndpoints.unpublish(id),
  archive: (id: string): Promise<AdminNewsArticle> => newsEndpoints.archive(id),
};

export const staticPageRepository = {
  list: (): Promise<AdminStaticPage[]> => staticPageEndpoints.list(),

  get: (slug: StaticPageSlug): Promise<AdminStaticPage> => staticPageEndpoints.get(slug),

  /** `async` for the reason `newsRepository.saveTranslation` is — the guard must reject. */
  saveTranslation: async (
    slug: StaticPageSlug,
    lang: LanguageCode,
    body: ContentTranslationBody,
  ): Promise<AdminStaticPage> =>
    staticPageEndpoints.saveTranslation(slug, lang, parseTranslation(body)),

  preview: (slug: StaticPageSlug, lang: LanguageCode): Promise<ContentPreview> =>
    staticPageEndpoints.preview(slug, lang),

  publish: (slug: StaticPageSlug): Promise<AdminStaticPage> => staticPageEndpoints.publish(slug),
};
