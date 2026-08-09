/**
 * The decision note, with the sentences the office writes every day already written.
 *
 * Every decision in the console is gated on a note of at least ten characters,
 * because the supplier reads it as the reason (AC-06). The cost of that rule is
 * paid by a clerk who types the same four sentences forty times a day, in a
 * language that may not be the one the console is set to — and the observable
 * failure mode is not an empty note, which the button already refuses, but
 * "checked ok", which passes the length check and tells the supplier nothing.
 *
 * So the common notes are offered as chips. Three deliberate choices:
 *
 *  - **The chip is a handle, not the note.** Its label is two or three words; what
 *    lands in the textarea is a whole sentence the supplier can read on its own.
 *    The sentence is on the chip's `title` for a hover, but the real preview is
 *    the textarea itself — the text arrives there instantly and stays editable,
 *    which is the point. A preset that cannot be edited afterwards would be a
 *    worse note than the one the clerk would have typed.
 *  - **Picking appends, and picking again removes.** Nothing the clerk typed is
 *    ever destroyed by a click, two chips compose into one note, and a misclick
 *    is undone by the same button that caused it. `aria-pressed` says which are
 *    in, so the state is not carried by the icon alone.
 *  - **Focus goes back to the textarea, caret at the end.** The chips are a
 *    starting point, not a form: the clerk almost always adds the supplier's own
 *    detail after one. Leaving focus on the chip means a keyboard user tabs back
 *    for every note.
 *
 * The suggestions themselves live in the string tables, not here, because they are
 * *copy* — a factory that words its rejections differently, or an office working in
 * Tamil, changes en.ts/ta.ts and nothing else. They are per verb where the verb is
 * known before the dialog opens (M9, credit) and one list where it is not (tea
 * packets, whose dialog carries both buttons).
 */

import { useEffect, useId, useRef } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { toggleNoteSuggestion } from '@/lib/noteSuggestion';

export interface NoteSuggestion {
  /** The chip's words. Short — it is a handle, not the note. */
  label: string;
  /** What lands in the note. A whole sentence, because the supplier reads it alone. */
  text: string;
}

export interface DecisionNoteFieldProps {
  label: string;
  hint?: string;
  placeholder?: string;
  /** Resolved message, already translated. */
  error?: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: NoteSuggestion[];
  /** Names the chip row, for the clerk and for a screen reader. */
  suggestionsLabel: string;
  autoFocus?: boolean;
}

export function DecisionNoteField({
  label,
  hint,
  placeholder,
  error,
  value,
  onChange,
  suggestions,
  suggestionsLabel,
  autoFocus = true,
}: DecisionNoteFieldProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const groupId = useId();

  /**
   * Set when a chip is clicked, read once the new note is in the DOM.
   *
   * Focus cannot be moved inside the click handler: the textarea still holds the
   * old value there, so the caret would land at the old end and the clerk would
   * type into the middle of the sentence they just inserted.
   */
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!returnFocus.current) return;
    returnFocus.current = false;
    const el = textarea.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [value]);

  return (
    <Field label={label} required hint={hint} error={error}>
      {({ id, describedBy, invalid, required }) => (
        <>
          <Textarea
            ref={textarea}
            id={id}
            autoFocus={autoFocus}
            value={value}
            placeholder={placeholder}
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            onChange={(event) => onChange(event.target.value)}
          />

          {suggestions.length > 0 ? (
            <div role="group" aria-labelledby={groupId} className="flex flex-wrap items-center gap-xs">
              <span id={groupId} className="text-caption text-text-secondary">
                {suggestionsLabel}
              </span>
              {suggestions.map((suggestion) => {
                const picked = value.includes(suggestion.text);
                return (
                  <Button
                    key={suggestion.label}
                    type="button"
                    size="sm"
                    aria-pressed={picked}
                    // The whole sentence, for anyone who wants to read it before
                    // committing it. Not the only way to see it — it is in the
                    // textarea a moment later, and removable from the same chip.
                    title={suggestion.text}
                    iconLeft={
                      picked ? (
                        <Check className="size-icon-xs" aria-hidden />
                      ) : (
                        <Plus className="size-icon-xs" aria-hidden />
                      )
                    }
                    onClick={() => {
                      returnFocus.current = true;
                      onChange(toggleNoteSuggestion(value, suggestion.text));
                    }}
                  >
                    {suggestion.label}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </Field>
  );
}
