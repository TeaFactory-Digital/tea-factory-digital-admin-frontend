/**
 * M11 Promo banners — the editor v1 never built.
 *
 * `enablePromoBanner` shipped in the flag set, `PromoBanner` shipped in the domain
 * package, `banners.md` specified the whole feature, and there was no way to author one.
 * A factory could turn the flag on and get nothing — which is worse than the feature not
 * existing, because the switch says otherwise.
 *
 * Modelled on `news.ts` deliberately: same per-language save, same three lifecycle verbs,
 * same server-resolved preview. An editor should not have to learn a second content
 * model to write a banner, and a second fallback implementation is the AC-08 failure.
 *
 * The two endpoints that have no counterpart in M11 are the two things a banner has that
 * an article does not — a live window, and an action the app might refuse.
 */

import type {
  AdminPromoBanner,
  BannerDraft,
  BannerListItem,
  BannerPatch,
  BannerQuery,
  BannerTranslationBody,
  ContentPreview,
  LanguageCode,
  Paged,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const bannerEndpoints = {
  list: (query: BannerQuery = {}) =>
    apiClient
      .get<Paged<BannerListItem>>('/admin/banners', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient.get<AdminPromoBanner>(`/admin/banners/${id}`).then((response) => response.data),

  /**
   * `422 fallback-translation-missing` when the fallback copy is absent, and
   * `422 banner-action-refused` when the button would go somewhere the app will not
   * open. The second is the one worth stating: the app's response to an unresolvable
   * action is to render the artwork *without a button* and say nothing, so a banner
   * saved with a bad action looks published to the office and is inert on the phone.
   */
  create: (body: BannerDraft) =>
    apiClient.post<AdminPromoBanner>('/admin/banners', body).then((response) => response.data),

  /** Artwork, window and action. Copy moves through `saveTranslation`. */
  patch: (id: string, body: BannerPatch) =>
    apiClient
      .patch<AdminPromoBanner>(`/admin/banners/${id}`, body)
      .then((response) => response.data),

  /** Save one language — a `PUT`, for the same reason M11's is. */
  saveTranslation: (id: string, lang: LanguageCode, body: BannerTranslationBody) =>
    apiClient
      .put<AdminPromoBanner>(`/admin/banners/${id}/translations/${lang}`, body)
      .then((response) => response.data),

  /** What a reader in `lang` gets, resolved by the server rather than by this console. */
  preview: (id: string, lang: LanguageCode) =>
    apiClient
      .get<ContentPreview>(`/admin/banners/${id}/preview`, { params: toParams({ lang }) })
      .then((response) => response.data),

  publish: (id: string) =>
    apiClient
      .post<AdminPromoBanner>(`/admin/banners/${id}/publish`, {})
      .then((response) => response.data),

  /**
   * Take it down now, whatever the window says.
   *
   * The window is a schedule and this is an intervention — a banner announcing a price
   * that turned out to be wrong has to stop being shown this afternoon, not when
   * `endsAt` comes round. Distinct from editing `endsAt` because the office wants the
   * record to say it was withdrawn.
   */
  unpublish: (id: string) =>
    apiClient
      .post<AdminPromoBanner>(`/admin/banners/${id}/unpublish`, {})
      .then((response) => response.data),

  /** Out of the list, still in the record. There is no delete here either. */
  archive: (id: string) =>
    apiClient
      .post<AdminPromoBanner>(`/admin/banners/${id}/archive`, {})
      .then((response) => response.data),
};
