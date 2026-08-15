/**
 * The time half of a date-and-time field.
 *
 * **shadcn has no time component.** Its registry carries `Calendar` and `Date Picker` and
 * nothing else temporal; the date-and-time examples in its own docs are a calendar beside
 * a native `<input type="time">`. So there was nothing to copy here, and this is written
 * to match `<DatePicker>` rather than to match a component that does not exist.
 *
 * ## Why the native input is kept underneath
 *
 * The same argument that replaced `type="date"` does *not* carry over. A native date input
 * is drawn by the browser end to end — the text, the icon and the panel — so it cannot be
 * themed. A native **time** input renders its `HH:MM` as ordinary inline text that takes
 * this console's font and colour; only the small picker glyph is browser chrome, and that
 * can be hidden. What is left is a field that already does the two hard things well:
 * segment-by-segment arrow-key editing, and locale-correct 12- or 24-hour display for
 * whoever is reading it.
 *
 * Rewriting that as two number boxes would lose both to gain nothing a token cannot fix.
 * So the input stays and the *affordance* is replaced: the browser's glyph is hidden and a
 * clock button opens the same kind of popover the calendar uses, so the pair reads as one
 * control instead of as two different products side by side.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Input } from './Input';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { cn } from '@/lib/cn';

/**
 * Minutes between the offered slots.
 *
 * Half-hourly, because these are opening windows rather than appointments: a banner runs
 * from the morning to the end of the month, and a list at five-minute steps is 288 rows to
 * scroll for a value that is nearly always on the hour. Anything in between is still
 * typeable — the list is a shortcut, not the vocabulary.
 */
const DEFAULT_STEP_MINUTES = 30;

interface TimePickerProps {
  /** `HH:mm`, 24-hour, regardless of how the browser chooses to display it. */
  value: string;
  onChange: (next: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  stepMinutes?: number;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

function slotsEvery(minutes: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += minutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

export function TimePicker({
  value,
  onChange,
  id,
  className,
  disabled,
  invalid,
  required,
  stepMinutes = DEFAULT_STEP_MINUTES,
  ...aria
}: TimePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => slotsEvery(stepMinutes), [stepMinutes]);

  /**
   * Open on the current value rather than at midnight.
   *
   * A list of 48 rows that always starts at `00:00` puts an 18:00 window three-quarters of
   * a scroll away, every time it is opened — and gives no sign that anything is selected.
   */
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [open]);

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type="time"
        // The browser's own glyph, hidden: it opens a second picker that looks nothing
        // like the calendar next to it. The field itself stays native — see the note above.
        className="numeric w-32 pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
        fullWidth={false}
        disabled={disabled}
        invalid={invalid}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...aria}
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={t('common.openTimes')}
            className="absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-r-md text-text-secondary hover:text-text-primary disabled:text-disabled-contrast"
          >
            <Clock className="size-icon-sm" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-xs">
          <div
            ref={listRef}
            role="listbox"
            aria-label={t('common.openTimes')}
            className="flex max-h-64 flex-col overflow-y-auto"
          >
            {slots.map((slot) => {
              const selected = slot === value;
              return (
                <button
                  key={slot}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-selected={selected}
                  onClick={() => {
                    onChange(slot);
                    // Closed on choose, as the calendar is: one time is a complete answer.
                    setOpen(false);
                  }}
                  className={cn(
                    'numeric rounded-md px-md py-xs text-left text-body-small',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                    selected
                      ? 'bg-primary text-primary-contrast'
                      : 'text-text-primary hover:bg-surface-variant',
                  )}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
