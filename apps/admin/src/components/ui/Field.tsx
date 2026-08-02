/**
 * Form controls.
 *
 * Native `<input>`, `<textarea>` and `<select>` rather than Radix equivalents,
 * for one reason that outweighs the styling gain: **this is a keyboard product.**
 * A clerk enters hundreds of rows a day, and a native select opens on first
 * keystroke, filters by typing, and works with the OS's own accessibility tools.
 * A custom listbox is prettier and slower, and admin-console.md is explicit that
 * "speed of the repetitive path beats richness of the rare one".
 *
 * Radix is used where the platform has no equivalent — dialogs, toasts, menus.
 */

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'rounded-md border bg-surface px-md text-body-small text-text-primary placeholder:text-text-secondary disabled:bg-surface-variant disabled:text-disabled-contrast';

const CONTROL_OK = 'border-border';
const CONTROL_BAD = 'border-error';

/**
 * Width is a **variant, not a class the caller overrides**.
 *
 * `w-full` used to be baked into `CONTROL`, and a caller wanting an auto-width
 * filter passed `w-auto` after it. That silently loses: both classes have the
 * same specificity, so the winner is whichever Tailwind emits later in the
 * stylesheet — not whichever appears later in the attribute. The result was a
 * filter bar of full-width selects stacked one per row.
 *
 * This is the reason `lib/cn.ts` is not `tailwind-merge`: a component that needs
 * a different width should expose a variant, not accept arbitrary classes and
 * hope the merge order is right.
 */
const width = (fullWidth: boolean) => (fullWidth ? 'w-full' : 'w-auto');

export interface FieldRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  /**
   * Pass to the control so "required" is conveyed **programmatically**.
   *
   * The visual asterisk is drawn by CSS (`label[data-required]::after`) rather
   * than being a text node inside the label. Putting it in the markup makes the
   * field's accessible name "Email *", which a screen reader reads out as
   * "Email star" and which no `aria-hidden` reliably suppresses across tools.
   */
  required: boolean;
}

export interface FieldProps {
  label: ReactNode;
  /** Resolved message, already translated. Presence switches the control to error. */
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (props: FieldRenderProps) => ReactNode;
  className?: string;
}

/**
 * Label, control, hint and error, wired together.
 *
 * The render-prop shape exists so the ids connect: `aria-describedby` has to name
 * both the hint and the error, and a component that renders its own input cannot
 * know which of them a caller supplied.
 */
export function Field({ label, error, hint, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-xs', className)}>
      <label
        htmlFor={id}
        data-required={required || undefined}
        className="text-label text-text-primary"
      >
        {label}
      </label>

      {children({
        id,
        describedBy,
        invalid: Boolean(error),
        required: Boolean(required),
      })}

      {hint ? (
        <p id={hintId} className="text-caption text-text-secondary">
          {hint}
        </p>
      ) : null}

      {/* `role="alert"` so a validation failure is announced, not only shown. */}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; fullWidth?: boolean }
>(function Input({ invalid, fullWidth = true, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        width(fullWidth),
        'h-10',
        invalid ? CONTROL_BAD : CONTROL_OK,
        className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; fullWidth?: boolean }
>(function Textarea({ invalid, fullWidth = true, className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        width(fullWidth),
        'py-sm leading-normal',
        invalid ? CONTROL_BAD : CONTROL_OK,
        className,
      )}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; fullWidth?: boolean }
>(function Select({ invalid, fullWidth = true, className, children, ...rest }, ref) {
  const selectClassName = cn(
    CONTROL,
    width(fullWidth),
    'h-10 appearance-none pr-10',
    invalid ? CONTROL_BAD : CONTROL_OK,
    className,
  );

  return (
    <div className={cn('relative', width(fullWidth))}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={selectClassName}
        {...rest}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-text-secondary"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
});

/**
 * A search box that submits as you type.
 *
 * Debouncing is the caller's job, not this component's — the supplier grid wants
 * ~250 ms, and a filter over an already-loaded list wants none.
 */
export const SearchInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; fullWidth?: boolean }
>(function SearchInput({ label, fullWidth = true, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="search"
      aria-label={label}
      placeholder={label}
      className={cn(CONTROL, CONTROL_OK, width(fullWidth), 'h-10', className)}
      {...rest}
    />
  );
});
