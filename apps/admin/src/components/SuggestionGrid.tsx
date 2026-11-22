/**
 * Suggested sentences under a note or reason box, as a grid of chips (22 November 2026).
 * A chip adds its sentence to the box, and clicking it again takes the sentence out, so the
 * office writes a reason in one click and still edits it freely. The chip shows its short
 * label; the whole sentence is its tooltip and lands in the box.
 */

import { useId } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toggleNoteSuggestion } from '@/lib/noteSuggestion';

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
}: {
  value: string;
  onChange: (next: string) => void;
  suggestions: NoteSuggestion[];
  /** Names the grid, for the clerk and for a screen reader. */
  label: string;
  /** After a chip changes the box: the caller puts the caret back at its end. */
  onPicked?: () => void;
}) {
  const groupId = useId();
  if (suggestions.length === 0) return null;
  return (
    <div role="group" aria-labelledby={groupId} className="mt-sm flex flex-col gap-xs">
      <span id={groupId} className="text-caption text-text-secondary">
        {label}
      </span>
      <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
        {suggestions.map((suggestion) => {
          const picked = value.includes(suggestion.text);
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
              onClick={() => {
                onChange(toggleNoteSuggestion(value, suggestion.text));
                onPicked?.();
              }}
            >
              {suggestion.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
