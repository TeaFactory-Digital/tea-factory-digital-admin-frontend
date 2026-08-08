/**
 * One language's banner copy.
 *
 * Deliberately not `TranslationEditor`. That component is shared between M11 and M12
 * because an article and a static page differ in lifecycle and not in copy — three
 * fields, the same three, in each language. A banner's copy is a different shape: a
 * headline, an optional supporting line, and a **button label**, which is the field that
 * decides whether the banner has a way out of it at all.
 *
 * Bending the shared editor into carrying a fourth optional field would have made
 * `withExcerpt`-style booleans multiply, and every one of them is a branch that renders
 * for nobody in one of the three callers. Two editors is the smaller cost.
 *
 * The three rules that do carry over unchanged, because they are about not losing an
 * editor's work rather than about the shape of the copy:
 *
 *  - **Keyed to the language**, so switching tabs remounts and Sinhala text can never be
 *    saved into the Tamil slot.
 *  - **Follows the record**, so a save's response replaces the fields rather than sitting
 *    underneath what is still typed.
 *  - **`lang` on the inputs**, so §20.2's Sinhala and Tamil wrapping applies while the
 *    copy is being written rather than only on the phone.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import {
  EDITORIAL_FALLBACK_LANGUAGE,
  MAX_CONTENT_TITLE_CHARS,
  type BannerTranslation,
  type BannerTranslationBody,
  type LanguageCode,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';

/**
 * A button label longer than this does not fit on the phones suppliers actually use.
 *
 * Not a guess dressed as a constant: `banners.md` caps the card's height at 62% of the
 * screen and the button sits at the bottom of it, so a label that wraps to three lines
 * pushes itself off a small display. Enforced as `maxLength` rather than a warning,
 * because there is no version of this the editor can usefully be asked to judge.
 */
const MAX_BUTTON_LABEL_CHARS = 24;

/** The supporting line is a sentence, not a circular. Longer belongs in a news article. */
const MAX_BANNER_BODY_CHARS = 240;

export function BannerTranslationEditor({
  lang,
  translation,
  /** The fallback copy, shown beside an empty tab as the thing being translated from. */
  source,
  readOnly,
  saving,
  onSave,
}: {
  lang: LanguageCode;
  translation: BannerTranslation | undefined;
  source: BannerTranslation | undefined;
  readOnly: boolean;
  saving: boolean;
  onSave: (body: BannerTranslationBody) => void;
}) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(translation?.title ?? '');
  const [body, setBody] = useState(translation?.body ?? '');
  const [buttonLabel, setButtonLabel] = useState(translation?.buttonLabel ?? '');

  useEffect(() => {
    setTitle(translation?.title ?? '');
    setBody(translation?.body ?? '');
    setButtonLabel(translation?.buttonLabel ?? '');
  }, [
    translation?.title,
    translation?.body,
    translation?.buttonLabel,
    translation?.updatedAt,
  ]);

  const dirty =
    title !== (translation?.title ?? '') ||
    body !== (translation?.body ?? '') ||
    buttonLabel !== (translation?.buttonLabel ?? '');

  // Matches `isBannerWritten`: headline and button label, body optional. The repository
  // refuses the same pair; this is so the button is not offered for a save that would
  // leave a banner nobody can act on.
  const complete = title.trim().length > 0 && buttonLabel.trim().length > 0;
  const isFallback = lang === EDITORIAL_FALLBACK_LANGUAGE;

  return (
    <div className="flex flex-col gap-md">
      {!isFallback && !translation && source ? (
        <div className="rounded-md border border-divider bg-surface-variant px-md py-sm">
          <p className="text-caption text-text-secondary">
            {t('content.translateFrom', {
              language: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
            })}
          </p>
          <p className="mt-xxs text-body-small font-medium text-text-primary">{source.title}</p>
          {source.body ? (
            <p className="mt-xxs whitespace-pre-wrap text-caption text-text-secondary">
              {source.body}
            </p>
          ) : null}
          <p className="mt-xxs text-caption text-text-secondary">
            {t('banners.field.buttonLabel')}: {source.buttonLabel}
          </p>
        </div>
      ) : null}

      <Field label={t('banners.field.headline')} required hint={t('banners.field.headlineHint')}>
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

      <Field label={t('banners.field.body')} hint={t('banners.field.bodyHint')}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            lang={lang}
            rows={3}
            maxLength={MAX_BANNER_BODY_CHARS}
            disabled={readOnly}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>

      <Field
        label={t('banners.field.buttonLabel')}
        required
        hint={t('banners.field.buttonHintLong', { max: MAX_BUTTON_LABEL_CHARS })}
      >
        {({ id, describedBy, required }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            required={required}
            lang={lang}
            maxLength={MAX_BUTTON_LABEL_CHARS}
            disabled={readOnly}
            value={buttonLabel}
            onChange={(event) => setButtonLabel(event.target.value)}
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
            onClick={() => onSave({ title, body: body || undefined, buttonLabel })}
          >
            {t('content.save', { language: t(`content.language.${lang}`) })}
          </Button>

          <p className="text-caption text-text-secondary">
            {!complete
              ? t('banners.saveNeedsCopy')
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
