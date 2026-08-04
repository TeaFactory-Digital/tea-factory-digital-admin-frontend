/**
 * The button.
 *
 * Variants rather than a `className` escape hatch: a caller that needs a
 * different background needs a variant, and a component that accepts arbitrary
 * classes for its own colours is a component whose brand can be overridden by
 * accident. `className` is still accepted, for layout only.
 *
 * Every size clears the 44 px minimum touch target on its shorter axis. The
 * console is a mouse-and-keyboard product, but the same office uses a touchscreen
 * all-in-one often enough that a 28 px-high button is a support call.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SpinnerMark } from './SpinnerMark';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-contrast hover:opacity-90 disabled:bg-disabled disabled:text-disabled-contrast',
  secondary:
    'bg-surface text-text-primary border border-border hover:bg-surface-variant disabled:text-disabled-contrast',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-variant disabled:text-disabled-contrast',
  // Destructive actions are the error colour, not a red hex — a factory whose
  // brand clashes with the default red can re-map one token.
  danger:
    'bg-error text-on-status hover:opacity-90 disabled:bg-disabled disabled:text-disabled-contrast',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-md text-label gap-xs',
  md: 'h-11 px-lg text-button gap-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, iconLeft, iconRight, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // A loading button is disabled, always. The alternative is a clerk clicking
      // Approve three times because nothing appeared to happen.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-opacity',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});

/**
 * The in-button spinner. Decorative: `aria-busy` on the button is what tells a
 * screen reader the action is running, and the button keeps its own label, so a
 * second "Loading…" here would only interrupt it.
 *
 * No colour class — the mark inherits the button's foreground, which is white on
 * primary and danger and the text colour on secondary and ghost.
 */
function Spinner() {
  return <SpinnerMark className="size-icon-sm" />;
}

/**
 * A button that is only an icon. Requires a label — an icon-only control with no
 * accessible name is invisible to a screen reader and ambiguous to everyone else.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'children' | 'iconLeft' | 'iconRight'> & { label: string; icon: ReactNode }
>(function IconButton({ label, icon, variant = 'ghost', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-md transition-opacity',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
