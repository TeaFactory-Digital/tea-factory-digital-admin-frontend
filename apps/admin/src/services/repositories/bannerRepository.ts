/**
 * M11 banners — the gateway.
 *
 * One guard here is not a courtesy and is the reason this file exists rather than the
 * screen calling the endpoints directly: **the action is validated with the app's own
 * resolver** before it leaves the browser.
 *
 * `bannerTarget()` is the function the phone runs. When it returns `null` the app renders
 * the artwork with no button and reports nothing — by design, because a supplier can
 * always close a banner. That silence is exactly what makes it dangerous to author
 * against: an editor who types `teafactory://manure`, or a path with a stray query
 * string, gets a saved record, a published banner and a dead button, and the only person
 * who could tell is the supplier who pressed it.
 *
 * So the console runs the resolver at the moment of authoring and refuses. The server
 * must refuse too (`banner-action-refused`); this is what puts the message under the
 * field being typed into.
 */

import {
  bannerActionProblem,
  type AdminPromoBanner,
  type BannerAction,
  type BannerDraft,
  type BannerListItem,
  type BannerPatch,
  type BannerQuery,
  type BannerTranslationBody,
  type ContentPreview,
  type LanguageCode,
  type Paged,
} from '@tfd/domain';
import { bannerEndpoints } from '../endpoints/banners';
import { ApiError } from '../api/errors';

/** The app's allowlist, run before the save. Throws what the server would answer. */
function assertActionUsable(action: BannerAction | undefined): void {
  const problem = bannerActionProblem(action);
  if (problem) {
    throw new ApiError({
      code: 'banner-action-refused',
      message: 'The app would not open this action.',
      // The specific rule, so the screen can say *which* mistake it was rather than
      // "invalid action" over a field with three ways to be wrong.
      details: { problemKey: problem },
    });
  }
}

/**
 * A banner translation needs a title and a button label; the body is optional.
 *
 * Deliberately not `contentTranslationSchema`, which insists on a body — right for an
 * article and wrong here, since plenty of banners are a headline and a button. Validated
 * field by field rather than by reaching for the article schema and disabling half of it.
 */
function parseTranslation(body: BannerTranslationBody): BannerTranslationBody {
  const title = body.title?.trim() ?? '';
  const buttonLabel = body.buttonLabel?.trim() ?? '';

  if (title.length === 0 || buttonLabel.length === 0) {
    throw new ApiError({
      code: 'note-required',
      message: 'A banner needs a headline and a button label.',
      details: { title: title.length === 0, buttonLabel: buttonLabel.length === 0 },
    });
  }

  return { title, buttonLabel, body: body.body?.trim() || undefined };
}

/**
 * The window has to be a window.
 *
 * `endsAt` before `startsAt` is a banner that can never show, and it fails **silently**:
 * `isBannerLive` simply returns false for ever, so the office sees a published row and
 * suppliers see nothing. Caught here because there is no screen anywhere that would
 * reveal it.
 */
function assertWindowUsable(startsAt: string | undefined, endsAt: string | null | undefined): void {
  if (!startsAt || endsAt == null) return;
  if (endsAt < startsAt) {
    throw new ApiError({
      code: 'banner-window-invalid',
      message: 'A banner cannot end before it starts.',
      details: { startsAt, endsAt },
    });
  }
}

export const bannerRepository = {
  list: (query: BannerQuery = {}): Promise<Paged<BannerListItem>> =>
    bannerEndpoints.list({ page: 0, pageSize: 25, ...query }),

  get: (id: string): Promise<AdminPromoBanner> => bannerEndpoints.get(id),

  create: async (body: BannerDraft): Promise<AdminPromoBanner> => {
    assertActionUsable(body.action);
    assertWindowUsable(body.startsAt, body.endsAt);

    const translations = body.translations.map((translation) => ({
      ...parseTranslation(translation),
      lang: translation.lang,
    }));

    if (translations.length === 0) {
      throw new ApiError({
        code: 'fallback-translation-missing',
        message: 'A banner needs its English copy before it can exist.',
      });
    }

    return bannerEndpoints.create({ ...body, translations });
  },

  patch: async (id: string, body: BannerPatch): Promise<AdminPromoBanner> => {
    if (body.action) assertActionUsable(body.action);
    assertWindowUsable(body.startsAt, body.endsAt);
    return bannerEndpoints.patch(id, body);
  },

  saveTranslation: async (
    id: string,
    lang: LanguageCode,
    body: BannerTranslationBody,
  ): Promise<AdminPromoBanner> => bannerEndpoints.saveTranslation(id, lang, parseTranslation(body)),

  preview: (id: string, lang: LanguageCode): Promise<ContentPreview> =>
    bannerEndpoints.preview(id, lang),

  publish: (id: string): Promise<AdminPromoBanner> => bannerEndpoints.publish(id),
  unpublish: (id: string): Promise<AdminPromoBanner> => bannerEndpoints.unpublish(id),
  archive: (id: string): Promise<AdminPromoBanner> => bannerEndpoints.archive(id),
};
