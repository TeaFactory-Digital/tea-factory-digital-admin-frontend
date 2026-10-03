/**
 * A page written as a list of points: FAQ questions, terms and privacy sections.
 *
 * Each point is a title and its text, with buttons to move it up or down and to delete it,
 * and one "Add" at the bottom. The list is turned back into the page's ordinary body text
 * (see `pagePoints.ts` in the domain package), so saving works exactly as before.
 *
 * Delete is immediate and unconfirmed **because nothing is lost until Save**: the editor's
 * Save button is the commit, and leaving without saving brings every point back.
 */

import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { PagePoints } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';

export interface PointLabels {
  /** "Question" / "Section title". */
  title: string;
  /** "Answer" / "Section text". */
  body: string;
  /** "Add a question" / "Add a section". */
  add: string;
  /** "Question {{n}}" / "Section {{n}}", for the heading of each card. */
  item: (n: number) => string;
}

export function PointsEditor({
  value,
  onChange,
  labels,
  lang,
  readOnly,
}: {
  value: PagePoints;
  onChange: (next: PagePoints) => void;
  labels: PointLabels;
  lang: string;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { points } = value;

  const setPoint = (index: number, patch: Partial<PagePoints['points'][number]>) =>
    onChange({
      ...value,
      points: points.map((point, i) => (i === index ? { ...point, ...patch } : point)),
    });

  const move = (index: number, by: -1 | 1) => {
    const next = [...points];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved!);
    onChange({ ...value, points: next });
  };

  const remove = (index: number) =>
    onChange({ ...value, points: points.filter((_, i) => i !== index) });

  const add = () => onChange({ ...value, points: [...points, { title: '', body: '' }] });

  return (
    <div className="flex flex-col gap-md">
      <Field label={t('content.points.intro')} hint={t('content.points.introHint')}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            lang={lang}
            rows={3}
            disabled={readOnly}
            value={value.intro}
            onChange={(event) => onChange({ ...value, intro: event.target.value })}
          />
        )}
      </Field>

      <ol className="flex flex-col gap-sm">
        {points.map((point, index) => (
          <li
            key={index}
            className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md"
          >
            <div className="flex items-center justify-between gap-sm">
              <span className="text-label text-text-secondary">{labels.item(index + 1)}</span>
              {readOnly ? null : (
                <span className="flex items-center gap-xxs">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('content.points.moveUp')}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-icon-sm" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('content.points.moveDown')}
                    disabled={index === points.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-icon-sm" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('content.points.delete', { item: labels.item(index + 1) })}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-icon-sm text-error" aria-hidden />
                  </Button>
                </span>
              )}
            </div>

            <Field label={labels.title} required>
              {({ id, describedBy, required }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  required={required}
                  lang={lang}
                  maxLength={200}
                  disabled={readOnly}
                  value={point.title}
                  onChange={(event) => setPoint(index, { title: event.target.value })}
                />
              )}
            </Field>
            <Field label={labels.body} required>
              {({ id, describedBy, required }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  required={required}
                  lang={lang}
                  rows={4}
                  disabled={readOnly}
                  value={point.body}
                  onChange={(event) => setPoint(index, { body: event.target.value })}
                />
              )}
            </Field>
          </li>
        ))}
      </ol>

      {readOnly ? null : (
        <div>
          <Button
            type="button"
            variant="secondary"
            iconLeft={<Plus className="size-icon-sm" aria-hidden />}
            onClick={add}
          >
            {labels.add}
          </Button>
        </div>
      )}
    </div>
  );
}
