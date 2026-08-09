/**
 * The month grid, on `react-day-picker` — the library shadcn's `<Calendar>` wraps.
 *
 * **The library is shadcn's; the styling is not, and that is deliberate.** shadcn's
 * calendar is written against its own CSS variables — `bg-background`,
 * `text-muted-foreground`, `bg-accent` — and none of those exist here. Every colour in
 * this console resolves to `var(--brand-color-*)`, written at runtime from the tenant's
 * `client_config` (see `styles/theme.css`), which is what lets one deployment rebrand per
 * factory. Pasted verbatim, this would have been the one component in the console that
 * ignored a factory's colours — visible the first time anybody looked at a tenant that
 * was not green.
 *
 * So the class names below are this project's tokens throughout. What comes from shadcn
 * is the shape: a bordered popover panel, a caption with month arrows, muted outside days,
 * a filled selected day and a ringed today.
 *
 * ## Colombo, not the browser's timezone
 *
 * `react-day-picker` works in `Date` objects, which are instants; the console works in
 * Colombo-local `YYYY-MM-DD` strings, because a delivery belongs to the day the leaf was
 * weighed (BR-104). The two are converted in `lib/localDate` and nowhere else, so a clerk
 * on a laptop still set to another timezone does not file a morning weighing under
 * yesterday.
 */

import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

const DAY_CELL =
  'size-9 rounded-md text-body-small text-text-primary hover:bg-surface-variant ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('w-fit', className)}
      classNames={{
        months: 'flex flex-col gap-md',
        month: 'flex flex-col gap-sm',
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'text-label font-semibold text-text-primary',
        nav: 'flex items-center gap-xxs',
        button_previous: cn(DAY_CELL, 'inline-flex items-center justify-center'),
        button_next: cn(DAY_CELL, 'inline-flex items-center justify-center'),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        // The column headings are labels, not data — the same weight as every other
        // secondary label in the console rather than the bold shadcn uses.
        weekday: 'size-9 text-caption font-normal text-text-secondary',
        week: 'flex w-full',
        day: 'p-0',
        day_button: cn(DAY_CELL, 'numeric'),
        /**
         * Selected is filled, today is only ringed.
         *
         * Both marked the same way — which shadcn's default very nearly does — makes the
         * pair unreadable in the common case where today *is* the selection.
         */
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-contrast [&>button]:hover:bg-primary',
        today: '[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary',
        outside: '[&>button]:text-text-secondary [&>button]:opacity-50',
        disabled: '[&>button]:text-disabled-contrast [&>button]:hover:bg-transparent',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        // The console's icon set, so the arrows match every other control rather than
        // shipping a second family alongside `lucide`.
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-icon-sm" {...rest} />
          ) : (
            <ChevronRight className="size-icon-sm" {...rest} />
          ),
      }}
      {...props}
    />
  );
}
