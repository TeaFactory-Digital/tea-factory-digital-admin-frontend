import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'flex min-w-0 rounded-md border bg-surface px-md text-body-small text-text-primary disabled:bg-surface-variant disabled:text-disabled-contrast';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, fullWidth = true, className, children, ...rest },
  ref,
) {
  const selectClassName = cn(
    CONTROL,
    fullWidth ? 'w-full' : 'w-auto',
    'h-10 appearance-none pr-10',
    invalid ? 'border-error' : 'border-border',
    className,
  );

  return (
    /**
     * `inline-block` when it is not full width, because the chevron is positioned against
     * **this** box rather than against the `<select>`.
     *
     * A `div` is block-level, so `w-auto` made the wrapper fill whatever contained it while
     * the `<select>` inside shrank to its widest option. The arrow then sat at the right
     * edge of the *container*, floating in open space — sometimes several inches from the
     * control it belongs to.
     *
     * Invisible in a filter bar, because a flex item shrinks to fit regardless. It shows
     * wherever `fullWidth={false}` lands in a normal block context: M13's capability
     * matrix, where every cell is a `<td>` wider than the word "Approve", had forty-five
     * detached arrows.
     */
    <div className={cn('relative', fullWidth ? 'w-full' : 'inline-block')}>
      <select ref={ref} aria-invalid={invalid || undefined} className={selectClassName} {...rest}>
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
