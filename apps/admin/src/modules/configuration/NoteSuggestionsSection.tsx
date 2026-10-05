/**
 * Common notes: the chips under the decision and reply boxes, in the factory's own words
 * (BACKEND-TODO #38).
 *
 * Six lists, one per box. Each chip has a short label and the sentence it adds, written per
 * language, so a Tamil-speaking clerk is offered Tamil sentences. **A list left empty uses
 * the built-in sentences**, so a factory that never opens this section loses nothing.
 *
 * Saved whole: a chip removed here must not come back from a merge on the server.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  NOTE_SUGGESTION_KEYS,
  type NoteSuggestionConfig,
  type NoteSuggestionKey,
  type NoteSuggestionsBlock,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { CardBody } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { SectionFooter, type SectionProps } from './SectionFooter';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Each language in its own script, so the buttons read the same in every console language. */
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', si: 'සිංහල', ta: 'தமிழ்' };

/** Drops chips with no words in any language, and lists left empty. */
function cleaned(block: NoteSuggestionsBlock): NoteSuggestionsBlock {
  const out: NoteSuggestionsBlock = {};
  for (const key of NOTE_SUGGESTION_KEYS) {
    const chips = (block[key] ?? []).filter(
      (chip) =>
        Object.values(chip.label).some((v) => v.trim()) &&
        Object.values(chip.text).some((v) => v.trim()),
    );
    if (chips.length > 0) out[key] = chips;
  }
  return out;
}

export function NoteSuggestionsSection(props: SectionProps) {
  const { t } = useTranslation();
  const languages = props.config.localization?.supportedLanguages?.length
    ? props.config.localization.supportedLanguages
    : ['en', 'si', 'ta'];

  const saved = useMemo(() => props.config.noteSuggestions ?? {}, [props.config.noteSuggestions]);
  const [draft, setDraft] = useState<NoteSuggestionsBlock>(saved);
  const [key, setKey] = useState<NoteSuggestionKey>(NOTE_SUGGESTION_KEYS[0]!);
  const [language, setLanguage] = useState(languages[0] ?? 'en');

  useEffect(() => setDraft(saved), [saved]);

  const chips = draft[key] ?? [];
  const setChips = (next: NoteSuggestionConfig[]) => setDraft({ ...draft, [key]: next });
  const update = (index: number, part: 'label' | 'text', value: string) =>
    setChips(
      chips.map((chip, i) =>
        i === index ? { ...chip, [part]: { ...chip[part], [language]: value } } : chip,
      ),
    );

  const patchValue = cleaned(draft);
  const dirty = !same(patchValue, cleaned(saved));

  return (
    <CardBody className="flex flex-col gap-lg">
      <p className="text-body-small text-text-secondary">{t('config.notes.intro')}</p>

      <div className="flex flex-wrap items-end gap-md">
        <Field label={t('config.notes.list')}>
          {({ id }) => (
            <Select
              id={id}
              value={key}
              onChange={(event) => setKey(event.target.value as NoteSuggestionKey)}
            >
              {NOTE_SUGGESTION_KEYS.map((one) => (
                <option key={one} value={one}>
                  {t(`config.notes.key.${one}`)}
                  {(draft[one]?.length ?? 0) > 0 ? ` (${draft[one]!.length})` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div
          role="group"
          aria-label={t('config.notes.language')}
          className="inline-flex rounded-md border border-border p-xxs"
        >
          {languages.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
              className={cn(
                'rounded-sm px-md py-xs text-body-small',
                language === code
                  ? 'bg-primary font-semibold text-primary-contrast'
                  : 'text-text-primary hover:bg-surface-variant',
              )}
            >
              {LANGUAGE_NAMES[code] ?? code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {chips.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-md text-body-small text-text-secondary">
          {t('config.notes.usingBuiltIn')}
        </p>
      ) : (
        <ul className="flex flex-col gap-md">
          {chips.map((chip, index) => (
            <li
              key={index}
              className="flex items-start gap-sm rounded-md border border-border p-md"
            >
              <div className="grid flex-1 gap-sm sm:grid-cols-[12rem_1fr]">
                <Input
                  aria-label={t('config.notes.label')}
                  placeholder={t('config.notes.label')}
                  disabled={props.readOnly}
                  value={chip.label[language] ?? ''}
                  onChange={(event) => update(index, 'label', event.target.value)}
                />
                <Textarea
                  aria-label={t('config.notes.text')}
                  placeholder={t('config.notes.text')}
                  rows={2}
                  disabled={props.readOnly}
                  value={chip.text[language] ?? ''}
                  onChange={(event) => update(index, 'text', event.target.value)}
                />
              </div>
              {props.readOnly ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('config.notes.remove')}
                  iconLeft={<Trash2 className="size-icon-sm" aria-hidden />}
                  onClick={() => setChips(chips.filter((_, i) => i !== index))}
                >
                  {t('config.notes.remove')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {props.readOnly ? null : (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          iconLeft={<Plus className="size-icon-sm" aria-hidden />}
          onClick={() => setChips([...chips, { label: {}, text: {} }])}
        >
          {t('config.notes.add')}
        </Button>
      )}

      <SectionFooter
        {...props}
        patch={{ noteSuggestions: patchValue }}
        dirty={dirty}
        onRevert={() => setDraft(saved)}
      />
    </CardBody>
  );
}
