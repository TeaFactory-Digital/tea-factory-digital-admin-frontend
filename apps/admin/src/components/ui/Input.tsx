import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'flex min-w-0 rounded-md border bg-surface px-md text-body-small text-text-primary placeholder:text-text-secondary disabled:bg-surface-variant disabled:text-disabled-contrast';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, fullWidth = true, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        fullWidth ? 'w-full' : 'w-auto',
        'h-10',
        invalid ? 'border-error' : 'border-border',
        className,
      )}
      {...rest}
    />
  );
});
