/**
 * Suggested sentences under a note or reason box, as a grid of chips (22 November 2026).
 * A chip adds its sentence to the box, and clicking it again takes the sentence out, so the
 * office writes a reason in one click and still edits it freely. The chip shows its short
 * label; the whole sentence is its tooltip and lands in the box.
 */

import { useId } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { toggleNoteSuggestion } from '@/lib/noteSuggestion';
import { playSound } from '@/lib/sound/uiSound';

export interface NoteSuggestion {
  /** The chip's words. Short: it is a handle, not the note. */
  label: string;
  /** What lands in the note. A whole sentence, because the supplier reads it alone. */
  text: string;
}

export function SuggestionGrid({
  value,
  onChange,
  suggestions,
  label,
  onPicked,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  suggestions: NoteSuggestion[];
  /** Names the grid, for the clerk and for a screen reader. */
  label: string;
  /** After a chip changes the box: the caller puts the caret back at its end. */
  onPicked?: () => void;
  /**
   * Small pills that wrap, for a box that shares its card with other things (the inquiry
   * reply under the conversation): the two-column grid of full buttons is for a dialog,
   * where the box is the only thing on it (24 November 2026).
   */
  compact?: boolean;
}) {
  const groupId = useId();
  if (suggestions.length === 0) return null;
  return (
    <div role="group" aria-labelledby={groupId} className="mt-sm flex flex-col gap-xs">
      <span id={groupId} className="text-caption text-text-secondary">
        {label}
      </span>
      <div className={compact ? 'flex flex-wrap gap-xs' : 'grid grid-cols-1 gap-xs sm:grid-cols-2'}>
        {suggestions.map((suggestion) => {
          const picked = value.includes(suggestion.text);
          const toggle = () => {
            // A sentence dropped into the box is heard; taking it out again is not.
            if (!picked) playSound('insert');
            onChange(toggleNoteSuggestion(value, suggestion.text));
            onPicked?.();
          };
          if (compact) {
            return (
              <button
                key={suggestion.label}
                type="button"
                aria-pressed={picked}
                title={suggestion.text}
                onClick={toggle}
                className={cn(
                  'inline-flex min-h-7 items-center gap-xxs rounded-full border px-sm text-caption font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  picked
                    ? 'border-primary bg-primary-muted text-primary'
                    : 'border-border bg-surface text-text-primary hover:border-primary hover:text-primary',
                )}
              >
                {picked ? <Check className="size-icon-xs" aria-hidden /> : <Plus className="size-icon-xs" aria-hidden />}
                {suggestion.label}
              </button>
            );
          }
          return (
            <Button
              key={suggestion.label}
              type="button"
              size="sm"
              variant={picked ? 'primary' : 'secondary'}
              aria-pressed={picked}
              title={suggestion.text}
              className="justify-start text-left"
              iconLeft={picked ? <Check className="size-icon-xs" aria-hidden /> : <Plus className="size-icon-xs" aria-hidden />}
              onClick={toggle}
            >
              {suggestion.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
