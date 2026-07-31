/**
 * i18n, wired for one language and built for three.
 *
 * The console chrome ships in English only (docs/white-label.md → Localization),
 * but every label resolves through `t()`. That is the difference between adding
 * Sinhala later as a copy deliverable and adding it as a refactor of every
 * screen — and M3's leaf-entry grid, used by weighing-point staff rather than
 * office staff, is the surface most likely to need it.
 *
 * `keySeparator: false` because the keys are flat and dotted, matching the mobile
 * app's tables. Without it, i18next would read `suppliers.title` as a path into a
 * nested object and find nothing.
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';

export const FALLBACK_LANGUAGE = 'en';

void i18next.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: FALLBACK_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
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

export { i18next };
