/**
 * Editorial content — the shared half of M11 and M12.
 *
 * **This file is AC-08.** The criterion is that editorial copy falls back to English
 * when a translation is missing *and that the gap is visible to the editor*, and the
 * only way both halves can be true is if the console and the app resolve a translation
 * with the same function. A console that re-implemented the fallback would show the
 * editor a preview of something the app does not render, which is a worse failure than
 * having no preview at all — the editor would sign off copy they never saw.
 *
 * So `resolveTranslation` is the app's behaviour, and everything else here exists to
 * describe it back to the office before they publish:
 *
 *  - **missing** — nothing written in that language. The app falls back.
 *  - **stale** — written, but older than the fallback it was translated from. The app
 *    renders it happily and the supplier reads last month's date. This is the gap
 *    AC-08's wording does not cover and the office hits second.
 *
 * One asymmetry is deliberate throughout: the **fallback language is required and every
 * other language is optional**. `EDITORIAL_FALLBACK_LANGUAGE` is "the fallback, not a
 * default" (constants.ts) — which only means anything if content can exist without a
 * full set, and is why publishing with gaps is *loud* rather than refused.
 */

import { EDITORIAL_FALLBACK_LANGUAGE, type LanguageCode } from './constants';

/**
 * One language's copy of an editorial record.
 *
 * `updatedAt` is per **translation**, not per record, and it is the only reason
 * staleness is detectable. A record-level timestamp cannot answer "was the Sinhala
 * written before or after this English correction", which is the question.
 */
export interface ContentTranslation {
  lang: LanguageCode;
  title: string;
  /** Feed and preview line. Absent on a static page, which has no feed. */
  excerpt?: string;
  body: string;
  updatedAt: string;
  updatedByName: string;
}

/** Per-language copy. A missing key is a missing translation — see `isWritten`. */
export type ContentTranslations = Partial<Record<LanguageCode, ContentTranslation>>;

/**
 * Is there actually copy here?
 *
 * A **present translation is not a written one**: an editor who opens the Sinhala tab,
 * types nothing and saves leaves a row with empty strings in it. Treating that as
 * translated is how a supplier gets a blank article, so "written" means both the title
 * and the body carry something once trimmed.
 */
export function isWritten(translation: ContentTranslation | undefined): boolean {
  if (!translation) return false;
  return translation.title.trim().length > 0 && translation.body.trim().length > 0;
}

/** The languages a record owes copy in and has none for. */
export function missingTranslations(
  translations: ContentTranslations,
  required: readonly LanguageCode[],
): LanguageCode[] {
  return required.filter((lang) => !isWritten(translations[lang]));
}

/**
 * Languages written *before* the fallback they were translated from was last edited.
 *
 * The failure this catches is quiet and common: the English article is corrected — a
 * date, a figure, a name — and the Sinhala one still says the old thing. The app has no
 * way to know, renders it, and the supplier reads copy the office believes it fixed.
 *
 * A translation exactly as new as the fallback is **not** stale: saving the fallback and
 * the translation in the same request is a legitimate way to publish a corrected pair,
 * and flagging it would train the office to ignore the flag.
 */
export function staleTranslations(
  translations: ContentTranslations,
  required: readonly LanguageCode[],
  fallback: LanguageCode = EDITORIAL_FALLBACK_LANGUAGE,
): LanguageCode[] {
  const source = translations[fallback];
  if (!isWritten(source)) return [];

  return required.filter((lang) => {
    if (lang === fallback) return false;
    const translation = translations[lang];
    if (!isWritten(translation)) return false;
    return translation!.updatedAt < source!.updatedAt;
  });
}

/** What a reader in `lang` actually gets, and whether it is their language. */
export interface ResolvedTranslation {
  translation: ContentTranslation;
  /** True when this is the fallback standing in for a language with no copy. */
  usedFallback: boolean;
}

/**
 * Resolve the copy a reader in `lang` sees — **the app's own behaviour**.
 *
 * Shared rather than described, because the console's preview is only worth having if
 * it is the same resolution. Returns `null` when even the fallback is unwritten, which
 * is the one state that must never reach a supplier: it is why publishing requires the
 * fallback language and nothing else does.
 */
export function resolveTranslation(
  translations: ContentTranslations,
  lang: LanguageCode,
  fallback: LanguageCode = EDITORIAL_FALLBACK_LANGUAGE,
): ResolvedTranslation | null {
  const requested = translations[lang];
  if (isWritten(requested)) return { translation: requested!, usedFallback: false };

  const source = translations[fallback];
  if (isWritten(source)) return { translation: source!, usedFallback: true };

  return null;
}

/**
 * May this record be published?
 *
 * **The fallback language is the only hard requirement**, and that is the AC-08 policy
 * decision made operable: content with gaps is publishable because the app falls back,
 * and content with no fallback is not publishable because there would be nothing to
 * fall back *to*. `missing` comes back alongside so a caller can warn about the rest
 * without asking a second question.
 */
export function publishability(
  translations: ContentTranslations,
  required: readonly LanguageCode[],
  fallback: LanguageCode = EDITORIAL_FALLBACK_LANGUAGE,
): { ok: boolean; missing: LanguageCode[]; stale: LanguageCode[] } {
  return {
    ok: isWritten(translations[fallback]),
    missing: missingTranslations(translations, required),
    stale: staleTranslations(translations, required, fallback),
  };
}

/**
 * A URL-safe slug from a title.
 *
 * Latin-only by necessity rather than by preference: a Sinhala title transliterates to
 * nothing useful here, so the slug is derived from the **fallback** copy and a title
 * with no Latin characters falls back to a timestamp-free placeholder the caller
 * suffixes. Slugs are a link target, not content — the supplier never reads one.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Script=Latin}\p{Nd}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');

  return slug.length > 0 ? slug : 'article';
}
