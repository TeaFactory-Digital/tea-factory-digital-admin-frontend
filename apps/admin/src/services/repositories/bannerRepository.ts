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
import { bannerEndpoints, type ServedBannerRow } from '../endpoints/banners';
import { paginate, type MutationAck, type StatusAck } from '../api/adapters';
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

/**
 * One served row into the grid row the console renders.
 *
 * Three things happen here and each is a gap being papered over rather than a preference:
 * `headline` becomes `title`, `imageUrl` becomes the `hasImage` boolean the grid actually
 * uses, and `staleLanguages` is filled in as empty because the API does not compute it
 * (gap **G-08**).
 *
 * That last one is the one to keep an eye on. An empty `staleLanguages` renders as *"no
 * translation is out of date"*, which is a claim rather than an absence — and AC-08 is
 * precisely about copy that was translated and then left behind by a correction. The
 * console cannot work it out either: it would need each translation's `updatedAt`, and
 * the row carries one timestamp for the whole banner.
 */
function toBannerListItem(row: ServedBannerRow): BannerListItem {
  return {
    id: row.id,
    title: row.headline,
    status: row.status,
    window: row.window,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    hasImage: Boolean(row.imageUrl),
    updatedAt: row.updatedAt,
    // The API sends `publishedByName`, never an editor's name. `''` rather than a
    // fabricated one — the column renders blank, which is true.
    updatedByName: row.publishedByName ?? '',
    missingLanguages: row.missingLanguages,
    staleLanguages: [],
  };
}

export const bannerRepository = {
  /**
   * **Filtered and paged here** — `GET /admin/banners` answers with every banner of this
   * factory in one array (gap **G-09**). `q` is applied locally against the headline,
   * because the API has no search on this resource at all and a banner list is short.
   */
  list: async (query: BannerQuery = {}): Promise<Paged<BannerListItem>> => {
    const rows = await bannerEndpoints.list(query);
    const needle = query.q?.trim().toLowerCase();
    const items = rows
      .map(toBannerListItem)
      .filter((row) => (needle ? row.title.toLowerCase().includes(needle) : true));

    return paginate(items, { page: query.page ?? 0, pageSize: query.pageSize ?? 25 });
  },

  /** ⚠ 404s until the API implements it — see `bannerEndpoints.get` (gap **G-08**). */
  get: (id: string): Promise<AdminPromoBanner> => bannerEndpoints.get(id),

  create: async (body: BannerDraft): Promise<StatusAck> => {
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

    /**
     * The **fallback language's copy travels flat**, not in a `translations` array.
     *
     * `POST /admin/banners` reads `title`, `body` and `buttonLabel` off the top level and
     * writes them as the English translation; it has no `translations` field, and zod
     * strips what it does not recognise — so a body carrying the array alone created a
     * banner with no copy at all, and the create succeeded. The other languages are saved
     * afterwards through `saveTranslation`, one at a time, as they are for news.
     */
    const fallback = translations[0]!;
    return bannerEndpoints.create({
      ...body,
      title: fallback.title,
      body: fallback.body,
      buttonLabel: fallback.buttonLabel,
    } as unknown as BannerDraft);
  },

  /** ⚠ 404s until the API implements it (gap **G-08**). */
  patch: async (id: string, body: BannerPatch): Promise<MutationAck> => {
    if (body.action) assertActionUsable(body.action);
    assertWindowUsable(body.startsAt, body.endsAt);
    return bannerEndpoints.patch(id, body);
  },

  saveTranslation: async (
    id: string,
    lang: LanguageCode,
    body: BannerTranslationBody,
  ): Promise<MutationAck> => bannerEndpoints.saveTranslation(id, lang, parseTranslation(body)),

  /** ⚠ 404s until the API implements it (gap **G-08**). */
  preview: (id: string, lang: LanguageCode): Promise<ContentPreview> =>
    bannerEndpoints.preview(id, lang),

  publish: (id: string): Promise<StatusAck> => bannerEndpoints.publish(id),
  unpublish: (id: string): Promise<StatusAck> => bannerEndpoints.unpublish(id),
  /** ⚠ 404s until the API implements it (gap **G-08**). */
  archive: (id: string): Promise<StatusAck> => bannerEndpoints.archive(id),
};
