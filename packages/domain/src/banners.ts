/**
 * Promo banners — the shared half of M11's banner editor.
 *
 * **A verbatim port of the app's `src/services/banners`**, and the port is the whole
 * point of the file. A banner's button is factory-authored content that arrives over
 * the wire and then drives navigation: the app resolves it to something known or to
 * nothing, and `bannerTarget()` returning `null` renders the artwork *without a
 * button* rather than a button that does nothing (mobile `docs/banners.md`).
 *
 * That silent refusal is safe in the app and useless in the console. An editor who
 * types `teafactory://manure` and saves would be told nothing, and the banner would
 * go live with a dead button — the failure nobody reports, because from the office's
 * side it looks published. So the console runs the **app's own resolver** at the
 * moment of authoring and refuses what the phone would drop.
 *
 * Two implementations of this allowlist would agree until the first one gained a
 * scheme, and the one that gained it would be the console.
 */

import type { BannerAction, PromoBanner } from './types/app';
import { EDITORIAL_FALLBACK_LANGUAGE, type LanguageCode } from './constants';
import type { ContentTranslation, ContentTranslations } from './content';

/**
 * Schemes a factory-authored button may open.
 *
 * `https` for the factory's own pages, `tel`/`mailto` because "call the office" is a
 * genuinely useful banner. Everything else is refused, and the app's own
 * `teafactory://` scheme is refused **deliberately**: an in-app destination goes
 * through `type: 'screen'`, where it is matched against routes that actually exist
 * rather than smuggled in as a URL.
 */
export const ALLOWED_BANNER_SCHEMES = ['https:', 'tel:', 'mailto:'] as const;

/**
 * A deep-link path as the app's linking config writes them: lowercase segments,
 * optionally with an id — `manure`, `bill/2026-07`, `news/news-1`.
 *
 * Anchored, and with no `.` allowed, so `..` cannot appear and a path cannot carry a
 * scheme, a host or a query string.
 */
export const BANNER_SCREEN_PATH = /^[a-z][a-z0-9-]*(\/[a-zA-Z0-9-]+)*$/;

export type BannerTarget =
  /** An in-app path the app hands to `useLinkTo`. */
  | { kind: 'path'; path: string }
  /** An external URL the app hands to `Linking.openURL`. */
  | { kind: 'url'; url: string };

/**
 * What the button will do on the phone, or `null` if this action is not something the
 * app is prepared to act on.
 *
 * In the app `null` is a real answer — the banner still renders and can still be
 * dismissed. In the console it is a refusal: see `bannerActionProblem`.
 */
export function bannerTarget(action: BannerAction | undefined): BannerTarget | null {
  if (!action) return null;

  if (action.type === 'screen') {
    const path = action.path?.replace(/^\/+/, '') ?? '';
    return BANNER_SCREEN_PATH.test(path) ? { kind: 'path', path } : null;
  }

  if (action.type === 'url') {
    const raw = action.url?.trim() ?? '';
    // `new URL` rather than a regex: it normalizes the scheme and rejects the
    // malformed input a hand-typed CMS field will eventually contain.
    try {
      const parsed = new URL(raw);
      return (ALLOWED_BANNER_SCHEMES as readonly string[]).includes(parsed.protocol.toLowerCase())
        ? { kind: 'url', url: raw }
        : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Why the app would drop this action, as an i18n key — or `null` when it is fine.
 *
 * A **key naming the specific rule**, not a boolean, because "invalid action" sends the
 * editor back to a field with no idea what is wrong with it. The three cases are three
 * different mistakes: a path with a slash too many, a scheme the phone will not open,
 * and `teafactory://` typed by somebody who reasonably assumed the app's own scheme was
 * the way to reach an app screen.
 */
export function bannerActionProblem(action: BannerAction | undefined): string | null {
  if (!action) return 'banners.action.missing';
  if (bannerTarget(action)) return null;

  if (action.type === 'screen') return 'banners.action.badPath';

  const raw = action.url?.trim() ?? '';
  // Named separately because it is the mistake an editor makes on purpose, and
  // "use an in-app screen instead" is the answer rather than "that scheme is refused".
  if (/^teafactory:/i.test(raw)) return 'banners.action.appSchemeRefused';
  return 'banners.action.badUrl';
}

/**
 * Is this banner inside its live window at `nowIso`?
 *
 * Evaluated in the console for the same reason the app evaluates it: the office needs
 * to see which of its banners is actually in front of suppliers right now, and a list
 * that showed an expired row as live is a list nobody trusts.
 */
export function isBannerLive(banner: Pick<PromoBanner, 'startsAt' | 'endsAt'>, nowIso: string): boolean {
  if (banner.startsAt > nowIso) return false;
  return banner.endsAt == null || banner.endsAt >= nowIso;
}

/** Where a banner is in its window. Three states, because "not live" hides two. */
export type BannerWindowState = 'scheduled' | 'live' | 'expired';

export function bannerWindowState(
  banner: Pick<PromoBanner, 'startsAt' | 'endsAt'>,
  nowIso: string,
): BannerWindowState {
  if (banner.startsAt > nowIso) return 'scheduled';
  if (banner.endsAt != null && banner.endsAt < nowIso) return 'expired';
  return 'live';
}

/**
 * One language's copy of a banner.
 *
 * Extends `ContentTranslation` rather than restating it, so a banner's translations are
 * structurally a `ContentTranslations` and `resolveTranslation` — the shared function
 * that *is* AC-08 — resolves a banner exactly as it resolves an article. `buttonLabel`
 * is the one field an article has no equivalent of.
 *
 * **`body` stays required, and empty is a real value.** The app's `PromoBanner` makes it
 * optional, and mirroring that here would break the `ContentTranslation` shape for the
 * sake of a distinction the gap rules do not use: a headline-only banner is a normal
 * banner, so "no supporting line" is `''` on the way in and `undefined` on the way out
 * (`projectBanner`). What decides whether a translation is *written* is the pair below,
 * never the body.
 */
export interface BannerTranslation extends ContentTranslation {
  /** The button's text. Localized, unlike the action it performs. */
  buttonLabel: string;
}

export type BannerTranslations = Partial<Record<LanguageCode, BannerTranslation>>;

/**
 * Is there actually copy here?
 *
 * Deliberately **not** `content.ts`'s `isWritten`. That one requires a title and a
 * body, which is right for an article and wrong for a banner: the supporting line is
 * optional — plenty of banners are a headline and a button — while a button with no
 * label is a button nobody can read. Reusing `isWritten` would have marked a perfectly
 * good headline-only banner as missing and a label-less one as written, which is both
 * halves of AC-08 pointing the wrong way.
 */
export function isBannerWritten(translation: BannerTranslation | undefined): boolean {
  if (!translation) return false;
  return translation.title.trim().length > 0 && translation.buttonLabel.trim().length > 0;
}

/** The languages a banner owes copy in and has none for. */
export function missingBannerTranslations(
  translations: BannerTranslations,
  required: readonly LanguageCode[],
): LanguageCode[] {
  return required.filter((lang) => !isBannerWritten(translations[lang]));
}

/**
 * Languages written *before* the fallback they were translated from was last edited.
 *
 * A banner-shaped copy of `staleTranslations` rather than a call to it, and the one line
 * that differs is the reason: that function asks `isWritten`, so a headline-only banner
 * counts as unwritten and its staleness would never be reported. The failure is quiet in
 * exactly the way the stale check exists to catch — the English headline is corrected,
 * the Sinhala one goes on saying the old thing, and nothing anywhere looks wrong.
 */
export function staleBannerTranslations(
  translations: BannerTranslations,
  required: readonly LanguageCode[],
  fallback: LanguageCode = EDITORIAL_FALLBACK_LANGUAGE,
): LanguageCode[] {
  const source = translations[fallback];
  if (!isBannerWritten(source)) return [];

  return required.filter((lang) => {
    if (lang === fallback) return false;
    const translation = translations[lang];
    if (!isBannerWritten(translation)) return false;
    // Equally new is not stale: saving the fallback and its translation in one sitting
    // is a legitimate way to publish a corrected pair.
    return translation!.updatedAt < source!.updatedAt;
  });
}

/**
 * May this banner go live?
 *
 * Same shape as `publishability` for an article, and the same asymmetry: the fallback
 * language is the only hard requirement, everything else is a gap the office is told
 * about and may publish over. A banner with a refused action is a **block** rather than
 * a gap — unlike a missing translation there is nothing for the app to fall back to,
 * and the supplier gets artwork with no way out of it.
 */
export function bannerPublishability(
  translations: BannerTranslations,
  action: BannerAction | undefined,
  required: readonly LanguageCode[],
  fallback: LanguageCode = EDITORIAL_FALLBACK_LANGUAGE,
): { ok: boolean; missing: LanguageCode[]; actionProblem: string | null } {
  const actionProblem = bannerActionProblem(action);
  return {
    ok: isBannerWritten(translations[fallback]) && actionProblem === null,
    missing: missingBannerTranslations(translations, required),
    actionProblem,
  };
}

/**
 * The single-language projection the app receives.
 *
 * The console holds every language at once and the phone holds one — the same
 * asymmetry `AdminNewsArticle` has with `NewsArticle`, and it is resolved with the
 * same fallback rule. Returns `null` when even the fallback is unwritten, which is the
 * one state that must never reach a supplier.
 */
export function projectBanner(
  banner: {
    id: string;
    imageUrl?: string;
    imageAspectRatio?: number;
    action: BannerAction;
    startsAt: string;
    endsAt: string | null;
  },
  translations: BannerTranslations,
  lang: LanguageCode,
  fallback: LanguageCode = EDITORIAL_FALLBACK_LANGUAGE,
): PromoBanner | null {
  const copy = isBannerWritten(translations[lang]) ? translations[lang] : translations[fallback];
  if (!isBannerWritten(copy)) return null;

  return {
    id: banner.id,
    imageUrl: banner.imageUrl,
    imageAspectRatio: banner.imageAspectRatio,
    title: copy!.title,
    // `''` on the record becomes `undefined` on the wire: the app's `PromoBanner` makes
    // the supporting line optional, and a blank string would render an empty paragraph.
    body: copy!.body.trim() ? copy!.body : undefined,
    buttonLabel: copy!.buttonLabel,
    action: banner.action,
    startsAt: banner.startsAt,
    endsAt: banner.endsAt,
  };
}

/** Narrowing helper for callers holding `ContentTranslations` from a shared code path. */
export function asBannerTranslations(translations: ContentTranslations): BannerTranslations {
  return translations as BannerTranslations;
}
