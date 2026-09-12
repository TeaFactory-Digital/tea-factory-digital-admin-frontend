/**
 * M11 News — the factory's feed, authored in every language the tenant sells in.
 *
 * The shape of this module is decided by one thing: **copy is saved one language at a
 * time.** `PUT /news/{id}/translations/{lang}` rather than a whole-record `PUT`, and the
 * reason is not tidiness — two editors translating one article is the normal case in an
 * office with a Sinhala speaker and a Tamil speaker, and a whole-record save means
 * whoever presses the button second silently discards the other's work.
 *
 * That granularity is also what makes staleness detectable at all: each translation
 * carries its own `updatedAt`, so "was the Sinhala written before or after this English
 * correction" has an answer (AC-08, `content.ts`).
 *
 * The lifecycle is three verbs, not a status field the client sets: `publish`,
 * `unpublish` and `archive`. A `PATCH { status }` would let a console put a record into
 * a state the server never agreed to — and publishing is the one act here with a refusal
 * behind it (`fallback-translation-missing`).
 */

import type {
  AdminNewsArticle,
  ContentPreview,
  ContentTranslationBody,
  LanguageCode,
  NewsListItem,
  NewsQuery,
  Paged,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import type { MutationAck, StatusAck } from '../api/adapters';
import { toParams } from './params';

/** What `POST /admin/news` acknowledges with — the id, the slug it minted, the state. */
export interface CreatedArticle extends StatusAck {
  slug: string;
}

/**
 * The body `POST /admin/news` actually reads: the fallback language's copy, flat.
 *
 * `NewsArticleDraft` carries a `translations` array and the API has no such field, so the
 * repository flattens before sending. See `contentRepository.newsRepository.create`.
 */
export interface NewsDraftBody {
  title: string;
  excerpt?: string;
  body: string;
  coverImageUrl?: string;
}

export const newsEndpoints = {
  list: (query: NewsQuery = {}) =>
    apiClient
      .get<Paged<NewsListItem>>('/admin/news', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient.get<AdminNewsArticle>(`/admin/news/${id}`).then((response) => response.data),

  /**
   * `422 fallback-translation-missing` when the fallback language's copy is absent.
   *
   * Answers `{ id, slug, status }` — enough for the dialog to navigate to the article it
   * just created, which is the only thing it does with the result.
   */
  create: (body: NewsDraftBody) =>
    apiClient.post<CreatedArticle>('/admin/news', body).then((response) => response.data),

  /**
   * **There is no `PATCH /admin/news/{id}`** (gap **G-07**).
   *
   * Nothing in this console calls one — an article's cover image and its copy both move
   * through `saveTranslation`, and the lifecycle moves through the three verbs below — so
   * the method is gone rather than left as a call that would 404. It comes back the day
   * the editor grows a field that is not copy.
   */

  /**
   * Save one language.
   *
   * A `PUT`, because writing the Sinhala copy twice is a correction and not a second
   * translation — the same reasoning that made M4's monthly rate a `PUT`.
   */
  saveTranslation: (id: string, lang: LanguageCode, body: ContentTranslationBody) =>
    apiClient
      .put<MutationAck>(`/admin/news/${id}/translations/${lang}`, body)
      .then((response) => response.data),

  /**
   * What a reader in `lang` actually gets — resolved by the **server**.
   *
   * Its own endpoint rather than composed in the console, so the preview is the app's
   * resolution rather than a second implementation of the fallback. An editor signing
   * off copy the app never renders is the AC-08 failure with the console's fingerprints
   * on it.
   */
  preview: (id: string, lang: LanguageCode) =>
    apiClient
      .get<ContentPreview>(`/admin/news/${id}/preview`, { params: toParams({ lang }) })
      .then((response) => response.data),

  /** `422 fallback-translation-missing` · `409 already-published`. */
  publish: (id: string) =>
    apiClient.post<StatusAck>(`/admin/news/${id}/publish`, {}).then((response) => response.data),

  /** Back to `draft`. The app drops it from the feed. */
  unpublish: (id: string) =>
    apiClient.post<StatusAck>(`/admin/news/${id}/unpublish`, {}).then((response) => response.data),

  /**
   * Out of the feed, still in the record.
   *
   * There is no delete. An article a supplier has read and may quote on the telephone
   * is evidence — the same rule that voids a delivery rather than removing it (§12.1).
   */
  archive: (id: string) =>
    apiClient.post<StatusAck>(`/admin/news/${id}/archive`, {}).then((response) => response.data),
};
