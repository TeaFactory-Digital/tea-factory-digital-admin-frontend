/**
 * The console's two date controls, replacing the browser's `type="date"` and
 * `type="datetime-local"`.
 *
 * **Why replace a control that worked:** a native date input is drawn by the browser, so
 * it is the one field in the console that cannot be themed. On a white-label product that
 * is not a detail — a factory whose console is otherwise entirely in its own colours gets
 * a Chrome-blue picker on the leaf-entry screen. It is also rendered differently by every
 * browser, which is a support problem for a screen used at a weighing point on whatever
 * machine is there.
 *
 * **What is kept from the native control:** the text field. It is still a real input that
 * accepts a typed `YYYY-MM-DD`, because a clerk entering a week of back-dated sheets types
 * the date far faster than they can click a grid — and taking that away to gain a calendar
 * would make the common path slower. The calendar is the *second* way in, not the only one.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { Calendar } from './Calendar';
import { fromLocalDate, toLocalDate } from '@/lib/localDate';
import { Input } from './Input';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { TimePicker } from './TimePicker';
import { cn } from '@/lib/cn';

interface BaseProps {
  id?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * Forwarded to the text field, not merely decorative.
   *
   * `Field` renders the asterisk itself and hands `required` down for the *control* to
   * carry, so dropping it here would leave a field marked required to a sighted reader
   * and optional to a screen reader — and let the banner form submit without a start.
   */
  required?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/**
 * A Colombo-local `YYYY-MM-DD`.
 *
 * The value in and out is the string, never a `Date`. Everything downstream — the query
 * parameter, `colomboDayOf`, the month lock — is already that shape, and handing a `Date`
 * across this boundary is what puts a weighing on the wrong day for a browser in another
 * timezone (BR-104).
 */
interface DatePickerProps extends BaseProps {
  value: string;
  onChange: (next: string) => void;
  /** Days the calendar refuses. The typed field is still validated by the caller. */
  disabledDates?: React.ComponentProps<typeof Calendar>['disabled'];
}

export function DatePicker({
  value,
  onChange,
  disabledDates,
  className,
  disabled,
  invalid,
  required,
  id,
  ...aria
}: DatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        className="numeric w-48 pr-10"
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
            // Labelled, because to a screen reader this is a second control on the same
            // field and "button" alone does not say what it opens.
            aria-label={t('common.openCalendar')}
            className="absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-r-md text-text-secondary hover:text-text-primary disabled:text-disabled-contrast"
          >
            <CalendarDays className="size-icon-sm" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-sm">
          <Calendar
            mode="single"
            autoFocus
            disabled={disabledDates}
            selected={toLocalDate(value)}
            // The month the field already names, so opening the calendar on a back-dated
            // sheet does not land in the current month with the selection off-screen.
            defaultMonth={toLocalDate(value)}
            onSelect={(next) => {
              if (!next) return;
              onChange(fromLocalDate(next));
              // Closed on choose: a single date is a complete answer, and leaving the
              // panel open over the field it just filled hides the result.
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * A local `YYYY-MM-DDTHH:mm`, for the two banner windows.
 *
 * Split into a calendar and a time field rather than one grid, because a calendar has no
 * opinion about the hour — shadcn's registry has no time component at all, and its own
 * date-and-time examples are exactly this pair.
 *
 * Both halves are this console's own controls: see `<TimePicker>` for why the time keeps a
 * native input underneath where the date does not.
 */
interface DateTimePickerProps extends BaseProps {
  value: string;
  onChange: (next: string) => void;
}

/** `2026-08-09T14:30` → `['2026-08-09', '14:30']`, tolerating a half-typed value. */
function splitLocal(value: string): [string, string] {
  const [date = '', time = ''] = value.split('T');
  return [date, time.slice(0, 5)];
}

export function DateTimePicker({
  value,
  onChange,
  className,
  disabled,
  invalid,
  required,
  id,
  ...aria
}: DateTimePickerProps) {
  const { t } = useTranslation();
  const [date, valueTime] = splitLocal(value);

  /**
   * The time is held here, not read back out of `value` — because `value` cannot hold it
   * while the date is empty.
   *
   * Derived from `value` alone, clearing the date to fix a typo emitted `''`, which threw
   * the time away with it: retyping the date brought the field back at **midnight**, and
   * a clerk correcting the day of a banner window silently lost the hour they had set.
   * Nothing on screen said so — the time field simply read `00:00` again.
   */
  const [time, setTime] = useState(valueTime);
  useEffect(() => {
    // Only when the parent actually carries one, so a cleared date does not wipe the
    // remembered time by feeding an empty string straight back in.
    if (valueTime) setTime(valueTime);
  }, [valueTime]);

  /**
   * A date with no time defaults to midnight rather than to empty.
   *
   * These two fields are a banner's *window*. Emitting `2026-08-09T` — a date with the
   * separator and nothing after it — parses as an invalid date, and the banner would
   * simply never show with nothing on screen to say why.
   */
  const emit = (nextDate: string, nextTime: string) => {
    setTime(nextTime);
    if (!nextDate) return onChange('');
    onChange(`${nextDate}T${nextTime || '00:00'}`);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-sm', className)}>
      <DatePicker
        id={id}
        value={date}
        onChange={(next) => emit(next, time)}
        disabled={disabled}
        invalid={invalid}
        // The date carries it, not the time: `emit` defaults a missing time to midnight,
        // so a window with a date and no hour is complete and one with neither is not.
        required={required}
        {...aria}
      />
      <TimePicker
        aria-label={t('common.time')}
        disabled={disabled}
        invalid={invalid}
        value={time}
        onChange={(next) => emit(date, next)}
      />
    </div>
  );
}
