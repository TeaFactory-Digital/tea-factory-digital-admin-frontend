/**
 * M12 Static content — the app's fixed pages.
 *
 * **A closed set, not a collection**, and every difference from M11 follows from it:
 * there is no `create`, no `delete` and no `archive`, because the app links to
 * `STATIC_PAGE_SLUGS` directly and a page that could be removed is a link to nowhere in
 * a shipped binary. The list endpoint returns all of them, including the ones the
 * factory has never written — an unwritten page is a **state to be shown**, not a row
 * that is absent.
 *
 * `publish` exists once per page and means "the factory has written this at all". After
 * that, an edit is live: a correction to the FAQ sitting in an unpublished draft would
 * leave the wrong answer in front of suppliers for as long as nobody remembered to press
 * a second button. The audit trail carries before/after on every edit, which is what
 * makes that safe rather than merely convenient.
 */

import type {
  AdminStaticPage,
  ContentPreview,
  ContentTranslationBody,
  LanguageCode,
  StaticPageSlug,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const staticPageEndpoints = {
  /**
   * Every page in the closed set, written or not.
   *
   * Not paged: there are six, and a pager over six rows is furniture.
   */
  list: () =>
    apiClient.get<AdminStaticPage[]>('/admin/static-pages').then((response) => response.data),

  get: (slug: StaticPageSlug) =>
    apiClient.get<AdminStaticPage>(`/admin/static-pages/${slug}`).then((response) => response.data),

  /** One language at a time, for the same reason as M11 — see `news.ts`. */
  saveTranslation: (slug: StaticPageSlug, lang: LanguageCode, body: ContentTranslationBody) =>
    apiClient
      .put<AdminStaticPage>(`/admin/static-pages/${slug}/translations/${lang}`, body)
      .then((response) => response.data),

  /** The server's resolution, so the console never previews its own fallback (AC-08). */
  preview: (slug: StaticPageSlug, lang: LanguageCode) =>
    apiClient
      .get<ContentPreview>(`/admin/static-pages/${slug}/preview`, { params: toParams({ lang }) })
      .then((response) => response.data),

  /** `422 fallback-translation-missing` · `409 already-published`. */
  publish: (slug: StaticPageSlug) =>
    apiClient
      .post<AdminStaticPage>(`/admin/static-pages/${slug}/publish`, {})
      .then((response) => response.data),
};
