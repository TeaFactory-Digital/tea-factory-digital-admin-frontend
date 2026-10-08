/**
 * A dropdown that opens as a popup list: shadcn/ui's Select, on `@radix-ui/react-select`.
 *
 * The native `<select>` (`./Select`) stays for dense forms and table cells, where the
 * browser's own list is fine. This is for filter bars, where the popup is themed with the
 * console's tokens, shows a tick against the current choice, and is keyboard-driven the
 * Radix way (type-ahead, arrows, Escape).
 *
 * Colours are brand tokens only: the console is white-labelled.
 */

import * as RadixSelect from '@radix-ui/react-select';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ─────────────────────────── shadcn primitives ─────────────────────────── */

export const SelectRoot = RadixSelect.Root;
export const SelectGroup = RadixSelect.Group;
export const SelectValue = RadixSelect.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof RadixSelect.Trigger>,
  ComponentPropsWithoutRef<typeof RadixSelect.Trigger>
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Trigger
    ref={ref}
    className={cn(
      'flex h-10 min-w-0 items-center justify-between gap-sm rounded-md border border-border bg-surface px-md text-body-small text-text-primary shadow-card',
      'transition-colors hover:bg-surface-variant',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      'data-[placeholder]:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50',
      '[&>span]:truncate',
      className,
    )}
    {...props}
  >
    {children}
    <RadixSelect.Icon asChild>
      <ChevronDown className="size-icon-sm shrink-0 text-text-secondary" aria-hidden />
    </RadixSelect.Icon>
  </RadixSelect.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = forwardRef<
  ElementRef<typeof RadixSelect.Content>,
  ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-80 min-w-32 overflow-hidden rounded-md border border-border bg-surface shadow-raised',
        position === 'popper' &&
          'w-full min-w-[var(--radix-select-trigger-width)] data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <RadixSelect.ScrollUpButton className="flex h-6 items-center justify-center text-text-secondary">
        <ChevronUp className="size-icon-sm" aria-hidden />
      </RadixSelect.ScrollUpButton>
      <RadixSelect.Viewport className="p-xxs">{children}</RadixSelect.Viewport>
      <RadixSelect.ScrollDownButton className="flex h-6 items-center justify-center text-text-secondary">
        <ChevronDown className="size-icon-sm" aria-hidden />
      </RadixSelect.ScrollDownButton>
    </RadixSelect.Content>
  </RadixSelect.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = forwardRef<
  ElementRef<typeof RadixSelect.Item>,
  ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-xs pl-xl pr-md text-body-small text-text-primary outline-none',
      'focus:bg-primary-muted focus:text-primary data-[state=checked]:font-semibold',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-xs flex size-icon-sm items-center justify-center">
      <RadixSelect.ItemIndicator>
        <Check className="size-icon-sm text-primary" aria-hidden />
      </RadixSelect.ItemIndicator>
    </span>
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
  </RadixSelect.Item>
));
SelectItem.displayName = 'SelectItem';

export const SelectSeparator = forwardRef<
  ElementRef<typeof RadixSelect.Separator>,
  ComponentPropsWithoutRef<typeof RadixSelect.Separator>
>(({ className, ...props }, ref) => (
  <RadixSelect.Separator
    ref={ref}
    className={cn('-mx-xxs my-xxs h-px bg-divider', className)}
    {...props}
  />
));
SelectSeparator.displayName = 'SelectSeparator';

/* ───────────────────────────── filter select ───────────────────────────── */

/**
 * Radix refuses an item whose value is `''`, which is exactly how every filter here spells
 * "no filter". So the "all" row travels as this sentinel and is turned back into `null`
 * before it reaches the caller.
 */
const ALL = '__all__';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * One filter dropdown: an "all" row, a separator, then the options.
 *
 * `value` and `onChange` speak `null` for "no filter", which is what the screens' URL
 * params already use, so swapping a native `<select>` for this is a one-line change.
 */
export function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
  className,
}: {
  /** The accessible name. The trigger shows the chosen option, not this. */
  label: string;
  allLabel: string;
  options: FilterOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  className?: string;
}) {
  return (
    <SelectRoot value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger aria-label={label} className={cn('w-auto min-w-44', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.length > 0 ? <SelectSeparator /> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
