/**
 * One language's copy, for an article or a static page alike.
 *
 * Shared between M11 and M12 because the two differ in their **lifecycle**, not in their
 * copy: an article is created, published and archived while a page simply exists, but
 * both are a title, an optional excerpt and a body in each of the tenant's languages.
 * Two editors would be two places for the AC-08 guards to drift.
 *
 * Three decisions worth stating, all of them about not losing an editor's work:
 *
 *  - **The form is keyed to the language.** Switching tabs remounts it, so Sinhala text
 *    can never be saved into the Tamil slot — the failure a shared draft state invites,
 *    and one nothing downstream could detect.
 *  - **Unsaved changes are stated, not guessed at.** The save button says whether there
 *    is anything to save, because an editor who switches tabs mid-sentence has lost the
 *    sentence and should be told before it happens rather than after.
 *  - **`lang` and `dir` are on the textarea.** Sinhala and Tamil run longer than English
 *    and get `overflow-wrap: anywhere` plus a looser line height from the base
 *    stylesheet (§20.2) — which only applies if the element declares its language.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import {
  EDITORIAL_FALLBACK_LANGUAGE,
  MAX_CONTENT_BODY_CHARS,
  MAX_CONTENT_EXCERPT_CHARS,
  MAX_CONTENT_TITLE_CHARS,
  type ContentTranslation,
  type ContentTranslationBody,
  type LanguageCode,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';

export function TranslationEditor({
  lang,
  translation,
  /** The fallback copy, shown beside an empty tab as the thing being translated from. */
  source,
  withExcerpt,
  readOnly,
  saving,
  onSave,
}: {
  lang: LanguageCode;
  translation: ContentTranslation | undefined;
  source: ContentTranslation | undefined;
  /** Articles appear in a feed and need one; a static page does not. */
  withExcerpt: boolean;
  readOnly: boolean;
  saving: boolean;
  onSave: (body: ContentTranslationBody) => void;
}) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(translation?.title ?? '');
  const [excerpt, setExcerpt] = useState(translation?.excerpt ?? '');
  const [body, setBody] = useState(translation?.body ?? '');

  /**
   * Follow the record, not the mount.
   *
   * A save returns the whole record, and without this the fields would keep whatever was
   * typed while the server's version — with its new `updatedAt` — sat underneath. The
   * next save would then re-send text the editor believes is already stored.
   */
  useEffect(() => {
    setTitle(translation?.title ?? '');
    setExcerpt(translation?.excerpt ?? '');
    setBody(translation?.body ?? '');
  }, [translation?.title, translation?.excerpt, translation?.body, translation?.updatedAt]);

  const dirty =
    title !== (translation?.title ?? '') ||
    excerpt !== (translation?.excerpt ?? '') ||
    body !== (translation?.body ?? '');

  // The schema half of this refusal lives in `contentRepository`; this is so the button
  // is not offered for a translation that would say nothing.
  const complete = title.trim().length > 0 && body.trim().length > 0;
  const isFallback = lang === EDITORIAL_FALLBACK_LANGUAGE;

  return (
    <div className="flex flex-col gap-md">
      {/* What is being translated from, when there is nothing here yet. Not decoration:
          an editor handed an empty Sinhala form has to find the English copy themselves,
          which means leaving the screen and coming back with half of it remembered. */}
      {!isFallback && !translation && source ? (
        <div className="rounded-md border border-divider bg-surface-variant px-md py-sm">
          <p className="text-caption text-text-secondary">
            {t('content.translateFrom', {
              language: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
            })}
          </p>
          <p className="mt-xxs text-body-small font-medium text-text-primary">{source.title}</p>
          <p className="mt-xxs whitespace-pre-wrap text-caption text-text-secondary">
            {source.body}
          </p>
        </div>
      ) : null}

      <Field label={t('content.field.title')} required hint={t('content.field.titleHint')}>
        {({ id, describedBy, required }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            required={required}
            lang={lang}
            maxLength={MAX_CONTENT_TITLE_CHARS}
            disabled={readOnly}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        )}
      </Field>

      {withExcerpt ? (
        <Field label={t('content.field.excerpt')} hint={t('content.field.excerptHint')}>
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              lang={lang}
              rows={2}
              maxLength={MAX_CONTENT_EXCERPT_CHARS}
              disabled={readOnly}
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
            />
          )}
        </Field>
      ) : null}

      <Field label={t('content.field.body')} required hint={t('content.field.bodyHint')}>
        {({ id, describedBy, required }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            required={required}
            // Declared, so the base stylesheet's Sinhala and Tamil line height and
            // wrapping rules apply while the copy is being typed rather than only once
            // it is on a supplier's phone.
            lang={lang}
            rows={14}
            maxLength={MAX_CONTENT_BODY_CHARS}
            disabled={readOnly}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>

      {readOnly ? (
        <p className="text-caption text-text-secondary">{t('content.readOnly')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-sm border-t border-divider pt-md">
          <Button
            variant="primary"
            disabled={!dirty || !complete}
            loading={saving}
            iconLeft={<Save className="size-icon-sm" aria-hidden />}
            onClick={() => onSave({ title, excerpt: excerpt || undefined, body })}
          >
            {t('content.save', { language: t(`content.language.${lang}`) })}
          </Button>

          {/* Said in words rather than left to a disabled button, because "nothing
              happens when I press save" is a support call either way. */}
          <p className="text-caption text-text-secondary">
            {!complete
              ? t('content.saveNeedsCopy')
              : dirty
                ? t('content.unsaved')
                : translation
                  ? t('content.savedAt', {
                      when: formatDateTime(translation.updatedAt),
                      name: translation.updatedByName,
                    })
                  : t('content.notWrittenYet')}
          </p>
        </div>
      )}
    </div>
  );
}
