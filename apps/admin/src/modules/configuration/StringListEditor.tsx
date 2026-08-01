/**
 * The add/remove list M14 needs four times over: collection points, banks, branches and
 * savings rates.
 *
 * Shared because the *behaviour* is the part worth getting right once, and it is not the
 * adding — it is the removing. Every one of these lists is referenced by records elsewhere:
 * a delivery names its collection point, a supplier's bank details name their bank. So a
 * row carries the count of what depends on it, and the caller decides whether that count
 * blocks or merely warns (`configImpact`).
 *
 * **Removal is staged, never immediate.** A row is marked for removal and the section is
 * saved as a whole, so the impact list can state the consequence of the complete change
 * before anything is committed — and so a mis-click is undone by not saving rather than by
 * remembering what was there.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

export function StringListEditor({
  items,
  onChange,
  label,
  addLabel,
  placeholder,
  /** How many records depend on each entry, by value. Drives the "in use" badge. */
  usage,
  readOnly,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  label: string;
  addLabel: string;
  placeholder: string;
  usage?: Record<string, number>;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  function add() {
    const value = draft.trim();
    // Silently ignoring a duplicate is kinder than an error for something the reader can
    // see is already in the list.
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setDraft('');
  }

  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="text-label text-text-primary">{label}</legend>

      <ul className="flex flex-col gap-xs">
        {items.map((item) => {
          const dependants = usage?.[item] ?? 0;
          return (
            <li
              key={item}
              className="flex flex-wrap items-center gap-sm rounded-md border border-divider px-md py-xs"
            >
              <span className="min-w-0 flex-1 text-body-small text-text-primary">{item}</span>

              {/* What depends on this row, on the row. The alternative is a reader
                  discovering it from a refusal after pressing save. */}
              {dependants > 0 ? (
                <Badge tone="neutral">{t('config.inUse', { count: dependants })}</Badge>
              ) : null}

              {!readOnly ? (
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={<X className="size-icon-sm" aria-hidden />}
                  onClick={() => onChange(items.filter((one) => one !== item))}
                >
                  {t('config.remove')}
                </Button>
              ) : null}
            </li>
          );
        })}

        {items.length === 0 ? (
          <li className="text-caption text-text-secondary">{t('config.listEmpty')}</li>
        ) : null}
      </ul>

      {!readOnly ? (
        <div className="flex flex-wrap items-end gap-sm">
          <Input
            aria-label={addLabel}
            placeholder={placeholder}
            className={cn('w-64')}
            fullWidth={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            // Enter adds, because this is a list somebody is typing several entries into
            // and reaching for the mouse between each one is the slow path.
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button
            variant="secondary"
            disabled={!draft.trim()}
            iconLeft={<Plus className="size-icon-sm" aria-hidden />}
            onClick={add}
          >
            {addLabel}
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * Undo for a whole section.
 *
 * Every section in M14 is edited locally and saved as a unit, so "I have changed three
 * things and want none of them" needs one control. Without it the only way back is to
 * remember the original values — which for a colour or a list of banks nobody does.
 */
export function RevertButton({ onRevert, disabled }: { onRevert: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      disabled={disabled}
      iconLeft={<RotateCcw className="size-icon-sm" aria-hidden />}
      onClick={onRevert}
    >
      {t('config.revert')}
    </Button>
  );
}
