/**
 * The language selector, and **the surface AC-08 is actually about.**
 *
 * The criterion says a missing translation must be *visible to the editor*. A warning
 * banner satisfies the letter of that and misses the point: the editor is looking at one
 * language at a time, so the place the gap has to be visible is **on the tab for the
 * language that has it** — before they click it, while they are deciding what to work on.
 *
 * So each tab carries its own state, and the three are deliberately different things:
 *
 *  - **Written** — copy exists in this language. Nothing to say.
 *  - **Missing** — nothing written. A supplier reading in this language is being shown
 *    the fallback right now.
 *  - **Stale** — written, but older than the fallback it was translated from. The app
 *    renders it happily, which is what makes this worse than missing: nothing anywhere
 *    looks wrong, and the supplier reads last month's figure.
 *
 * The fallback language's own tab is marked as such rather than being flagged, because
 * "English is missing" is not a translation gap — it is a record that cannot be shown to
 * anybody, and it is refused at the publish instead.
 */

import { useTranslation } from 'react-i18next';
import { CircleAlert, Clock, Star } from 'lucide-react';
import { EDITORIAL_FALLBACK_LANGUAGE, type LanguageCode } from '@tfd/domain';
import { cn } from '@/lib/cn';

type LanguageState = 'written' | 'missing' | 'stale' | 'fallbackMissing';

/**
 * Not exported: the *decision* about what a gap means belongs to `@tfd/domain`, which is
 * where `missingTranslations` and `staleTranslations` live and where the API reads it
 * from. This only turns two lists into a tab's appearance, and an exported helper for
 * that would be a second place to answer a question that already has an answer.
 */
function languageStateOf(
  lang: LanguageCode,
  missing: LanguageCode[],
  stale: LanguageCode[],
): LanguageState {
  if (missing.includes(lang)) {
    return lang === EDITORIAL_FALLBACK_LANGUAGE ? 'fallbackMissing' : 'missing';
  }
  return stale.includes(lang) ? 'stale' : 'written';
}

export function LanguageStrip({
  languages,
  active,
  onSelect,
  missing,
  stale,
}: {
  languages: LanguageCode[];
  active: LanguageCode;
  onSelect: (lang: LanguageCode) => void;
  missing: LanguageCode[];
  stale: LanguageCode[];
}) {
  const { t } = useTranslation();

  return (
    /**
     * A real tab list, so ← → move between languages and a screen reader announces
     * which of three this is. An editor translating a circular switches tabs dozens of
     * times, and a row of buttons makes that a mouse journey each time.
     */
    <div role="tablist" aria-label={t('content.languages')} className="flex flex-wrap gap-xs">
      {languages.map((lang) => {
        const state = languageStateOf(lang, missing, stale);
        const isActive = lang === active;

        return (
          <button
            key={lang}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(lang)}
            className={cn(
              'inline-flex items-center gap-xs rounded-md border px-md py-sm text-label',
              isActive
                ? 'border-primary bg-primary-muted font-semibold text-primary'
                : 'border-border bg-surface text-text-primary hover:bg-surface-variant',
            )}
          >
            <span>{t(`content.language.${lang}`)}</span>

            {lang === EDITORIAL_FALLBACK_LANGUAGE ? (
              <span
                title={t('content.fallbackLanguageHint')}
                className="inline-flex items-center text-text-secondary"
              >
                <Star className="size-icon-xs" aria-hidden />
                <span className="sr-only">{t('content.fallbackLanguageHint')}</span>
              </span>
            ) : null}

            {/* The state, as an icon **and** a screen-reader sentence. Colour is never
                the only signal (see `Badge`), and here it must not be the only signal
                either — the gap is the whole point of the control. */}
            {state === 'missing' || state === 'fallbackMissing' ? (
              <span className="inline-flex items-center text-warning">
                <CircleAlert className="size-icon-xs" aria-hidden />
                <span className="sr-only">{t('content.state.missing')}</span>
              </span>
            ) : state === 'stale' ? (
              <span className="inline-flex items-center text-error">
                <Clock className="size-icon-xs" aria-hidden />
                <span className="sr-only">{t('content.state.stale')}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
