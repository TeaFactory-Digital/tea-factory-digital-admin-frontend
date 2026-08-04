/**
 * i18n, wired for the three languages the console ships in.
 *
 * Every label already resolved through `t()` before any of them existed, which is
 * what made Sinhala and Tamil a copy deliverable rather than a refactor of every
 * screen (docs/white-label.md → Localization). M3's leaf-entry grid, used by
 * weighing-point staff rather than office staff, is the surface that needed it most.
 *
 * The tables in `./locales` are typed `Record<TranslationKey, string>`, so a key
 * present in `en` and missing from another language is a **compile error** — the
 * `fallbackLng` below is a runtime safety net for a build that somehow ships anyway,
 * not the guard.
 *
 * `keySeparator: false` because the keys are flat and dotted, matching the mobile
 * app's tables. Without it, i18next would read `suppliers.title` as a path into a
 * nested object and find nothing.
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { si } from './locales/si';
import { ta } from './locales/ta';
import { isLanguageCode, LANGUAGE_CODES, type LanguageCode } from './languages';

export const FALLBACK_LANGUAGE: LanguageCode = 'en';

/**
 * Where the chrome language lives between visits.
 *
 * `localStorage`, and that is not a contradiction of the rule in `authStore` that
 * keeps the access token out of it: that rule is about *secrets*, and which language
 * a shared office machine was left in is not one. It has to outlive the tab, because
 * the clerk who switches to Sinhala is not the person who opens the browser next
 * morning.
 *
 * Not the server either. A preference that needed the session would be unreadable on
 * the sign-in screen — the one screen where somebody who cannot read English is most
 * likely to be stuck.
 */
const STORAGE_KEY = 'tfd.admin.language';

/**
 * Reads the stored preference.
 *
 * Guarded, because Safari in private mode throws on `localStorage` rather than
 * returning null, and a console that refused to boot over a language preference
 * would be a spectacular way to fail.
 */
function storedLanguage(): LanguageCode | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistLanguage(code: LanguageCode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // A session that cannot persist the choice still honours it until reload.
  }
}

/**
 * English until somebody says otherwise.
 *
 * Deliberately not sniffed from `navigator.language`. Office machines report `en-*`
 * near-universally regardless of who is sitting at them, so detection would be a
 * coin toss dressed as a preference — and it would move the chrome under a clerk who
 * never asked for it. The factory's `defaultLanguage` config is not it either: that
 * is the *supplier app's* default, a different audience.
 */
const initialLanguage: LanguageCode = storedLanguage() ?? FALLBACK_LANGUAGE;

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    si: { translation: si },
    ta: { translation: ta },
  },
  lng: initialLanguage,
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...LANGUAGE_CODES],
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    // React escapes for us; double-escaping turns an apostrophe in a factory
    // name into `&#39;`.
    escapeValue: false,
  },
  returnNull: false,
  // A missing key is a bug, and in development it should look like one rather
  // than silently rendering the key.
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: import.meta.env.DEV
    ? (_lngs, _ns, key) => {
        console.warn(`[i18n] missing key: ${key}`);
      }
    : undefined,
});

/**
 * Keeps `<html lang>` on the active language.
 *
 * Not cosmetic. It is what tells a screen reader which voice to use — an English
 * synthesiser reading Sinhala is unintelligible rather than merely accented — and
 * what lets the browser resolve the Sinhala or Tamil face out of the font stack in
 * `packages/brand` instead of guessing per glyph run.
 */
function syncDocumentLanguage(code: string): void {
  document.documentElement.lang = code;
}

syncDocumentLanguage(i18next.language);

i18next.on('languageChanged', (code) => {
  syncDocumentLanguage(code);
  if (isLanguageCode(code)) persistLanguage(code);
});

/** Switches the chrome. Persistence and `<html lang>` follow from the event above. */
export async function setLanguage(code: LanguageCode): Promise<void> {
  await i18next.changeLanguage(code);
}

export { i18next };
