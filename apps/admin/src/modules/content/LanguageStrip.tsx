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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

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
    <Tabs value={active} onValueChange={(value) => onSelect(value as LanguageCode)}>
      <TabsList aria-label={t('content.languages')}>
        {languages.map((lang) => {
          const state = languageStateOf(lang, missing, stale);

          return (
            <TabsTrigger key={lang} value={lang} className="gap-xs">
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
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
