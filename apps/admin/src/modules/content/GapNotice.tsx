/**
 * What a gap actually costs, in words, on the record it is about.
 *
 * The language tabs say *which* languages have a gap. This says **what happens because
 * of it** — that a Sinhala supplier opening the app right now is reading English — and
 * that is the half of AC-08 a coloured dot cannot carry. An editor who does not know the
 * app falls back has no reason to treat a missing translation as urgent.
 *
 * Stale is stated separately and more strongly than missing, because it is the worse
 * failure and reads as the milder one: a missing translation shows the reader something
 * true in the wrong language, while a stale one shows them something false in the right
 * one. Nothing in the app looks wrong, which is why only this screen can catch it.
 */

import { useTranslation } from 'react-i18next';
import { Clock, Languages, TriangleAlert } from 'lucide-react';
import { EDITORIAL_FALLBACK_LANGUAGE, type ContentGaps, type LanguageCode } from '@tfd/domain';

export function GapNotice({
  gaps,
  published,
}: {
  gaps: ContentGaps;
  /** A draft's gaps are work in progress; a published record's are live. */
  published: boolean;
}) {
  const { t } = useTranslation();

  const names = (languages: LanguageCode[]) =>
    languages.map((lang) => t(`content.language.${lang}`)).join(', ');

  /**
   * The fallback missing is not a gap — it is a record with nothing to show anybody, and
   * it is refused at the publish. Reported as its own state so the editor is told the
   * one thing they must fix rather than being handed a list of three.
   */
  const fallbackMissing = gaps.missingLanguages.includes(EDITORIAL_FALLBACK_LANGUAGE);
  const otherMissing = gaps.missingLanguages.filter((lang) => lang !== EDITORIAL_FALLBACK_LANGUAGE);

  if (fallbackMissing) {
    return (
      <p
        role="alert"
        className="flex items-start gap-xs rounded-md bg-error-muted px-md py-sm text-body-small text-error"
      >
        <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
        {t('content.gap.fallbackMissing', {
          language: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
        })}
      </p>
    );
  }

  if (otherMissing.length === 0 && gaps.staleLanguages.length === 0) {
    return (
      <p className="flex items-start gap-xs rounded-md bg-success-muted px-md py-sm text-body-small text-success">
        <Languages className="mt-xxs size-icon-sm shrink-0" aria-hidden />
        {t('content.gap.complete')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-xs">
      {gaps.staleLanguages.length > 0 ? (
        <p className="flex items-start gap-xs rounded-md bg-error-muted px-md py-sm text-body-small text-error">
          <Clock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          {t('content.gap.stale', { languages: names(gaps.staleLanguages) })}
        </p>
      ) : null}

      {otherMissing.length > 0 ? (
        <p className="flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
          <Languages className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          {published
            ? t('content.gap.missingLive', {
                languages: names(otherMissing),
                fallback: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
              })
            : t('content.gap.missingDraft', { languages: names(otherMissing) })}
        </p>
      ) : null}
    </div>
  );
}
