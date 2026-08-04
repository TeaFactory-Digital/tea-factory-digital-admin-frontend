/**
 * The three languages the console chrome ships in, and the one place they are named.
 *
 * Deliberately **not** in the string tables. A language picker has to show every
 * option in its own script no matter which language is currently active — a Tamil
 * clerk handed a machine left in Sinhala finds their way out by recognising தமிழ்,
 * not by reading a Sinhala word for "Tamil". Routing these through `t()` would
 * translate them all into the active language and break exactly the person the
 * picker exists for.
 *
 * `content.language.*` in the string tables is a different thing and stays: those
 * are for *talking about* a language in prose ("no Sinhala copy yet"), where the
 * reader's own language is the right one to use.
 */

/** BCP-47 codes, and the keys of the `resources` map in `./index.ts`. */
export const LANGUAGE_CODES = ['si', 'en', 'ta'] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface Language {
  code: LanguageCode;
  /**
   * What the picker shows. Short, because it sits in a 14px-tall chrome control
   * next to the factory name — `EN`'s two letters are the width budget, and
   * සිංහල spelled out is five glyph clusters.
   */
  label: string;
  /**
   * The full endonym, used as the control's accessible name and its tooltip. A
   * screen reader reading "සිං" letter by letter is not a language name; this is
   * what makes the short label unambiguous without spending the width.
   */
  name: string;
}

/**
 * Sinhala first, then English, then Tamil.
 *
 * The order is the country's, not this repository's — it is the order on a Sri
 * Lankan banknote, an ID card and a government form, and a clerk looking for their
 * own language looks where every other official surface has put it.
 */
export const LANGUAGES: readonly Language[] = [
  { code: 'si', label: 'සිං', name: 'සිංහල' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ta', label: 'தமிழ்', name: 'தமிழ்' },
] as const;

/** Narrows an arbitrary string — a stored preference, a URL — to a supported code. */
export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value);
}
