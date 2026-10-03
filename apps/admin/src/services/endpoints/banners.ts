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
} from '@tfd/domain';
import { apiClient } from '../api/client';
import type { MutationAck, StatusAck } from '../api/adapters';
import { toParams } from './params';

/**
 * What `GET /admin/banners` actually puts on the wire.
 *
 * A bare array, and the headline is spelled `headline` rather than `title`
 * (gap **G-09** — still a bare array). `staleLanguages` is absent entirely — the API computes
 * `missingLanguages` and stops there, so the console cannot tell "never translated" from
 * "translated before the English was corrected", which is half of what AC-08 is about.
 */
export interface ServedBannerRow {
  id: string;
  status: BannerListItem['status'];
  imageUrl: string | null;
  imageAspectRatio: number | null;
  action: unknown;
  startsAt: string;
  endsAt: string | null;
  window: BannerListItem['window'];
  headline: string;
  missingLanguages: LanguageCode[];
  publishedByName: string | null;
  updatedAt: string;
}

export const bannerEndpoints = {
  /**
   * Unpaged and bare — `bannerRepository` maps and wraps it.
   *
   * `status` and `window` are the only filters the API honours, and `window` implies
   * `status: published`, which is right: a scheduled draft is not scheduled for anything.
   */
  list: (query: BannerQuery = {}) =>
    apiClient
      .get<ServedBannerRow[]>('/admin/banners', {
        params: toParams({ status: query.status, window: query.window }),
      })
      .then((response) => response.data),

  /**
   * One banner, **with its `translations`** — the call the editor is built on.
   *
   * It did not exist for a while (gap **G-08**), and nothing could be synthesised from
   * the list row, which carries no copy at all: a banner's Sinhala headline is either
   * sent or it is not. So the path and the screen were kept and the editor showed its
   * error state, rather than opening three empty language tabs over a record that had
   * text in it.
   */
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
    apiClient.post<StatusAck>('/admin/banners', body).then((response) => response.data),

  /** Artwork, window and action — the fields that are not copy. */
  patch: (id: string, body: BannerPatch) =>
    apiClient.patch<MutationAck>(`/admin/banners/${id}`, body).then((response) => response.data),

  /** Save one language — a `PUT`, for the same reason M11's is. Implemented. */
  saveTranslation: (id: string, lang: LanguageCode, body: BannerTranslationBody) =>
    apiClient
      .put<MutationAck>(`/admin/banners/${id}/translations/${lang}`, body)
      .then((response) => response.data),

  /**
   * What a reader in `lang` gets, resolved by the server rather than by this console —
   * and that is the whole point of it. A preview composed here would be a second
   * implementation of the fallback rule, which is the AC-08 failure with the console's
   * fingerprints on it. Banners have it now, as news always did (gap **G-08**, closed).
   */
  preview: (id: string, lang: LanguageCode) =>
    apiClient
      .get<ContentPreview>(`/admin/banners/${id}/preview`, { params: toParams({ lang }) })
      .then((response) => response.data),

  publish: (id: string) =>
    apiClient.post<StatusAck>(`/admin/banners/${id}/publish`, {}).then((response) => response.data),

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
      .post<StatusAck>(`/admin/banners/${id}/unpublish`, {})
      .then((response) => response.data),

  /**
   * Out of the list, still in the record. There is no delete here either.
   *
   * Banners were missing this while news had it (gap **G-08**), which was the asymmetry
   * worth naming: the two content types were built to the same model deliberately, and an
   * editor should not have to learn that one can be filed away and the other cannot.
   */
  archive: (id: string) =>
    apiClient.post<StatusAck>(`/admin/banners/${id}/archive`, {}).then((response) => response.data),
};
