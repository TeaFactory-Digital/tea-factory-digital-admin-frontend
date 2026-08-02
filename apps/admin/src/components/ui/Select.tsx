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
    <div className={cn('relative', fullWidth ? 'w-full' : 'w-auto')}>
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
