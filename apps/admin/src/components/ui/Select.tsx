/**
 * The console's dropdown: a native `<select>`'s props, a shadcn/Radix popup on screen.
 *
 * Callers still write `<Select value onChange={(e) => …e.target.value}>` with `<option>`
 * children, so every screen switched to the popup list without changing a line. The
 * options are read from the children; `onChange` receives an event-shaped object whose
 * `target.value` is the chosen option's value.
 *
 * Two details the native element handled for free and this has to handle itself:
 *  - **An empty value.** Radix refuses an item whose value is `''`, which is how every
 *    "All …" option is written. It travels as a sentinel and is turned back into `''`.
 *  - **The width.** `fullWidth={false}` keeps the wrapper `inline-block` so the control
 *    hugs its widest option; M13's capability matrix put forty-five of these in table
 *    cells far wider than the word "Approve" (see `selectWidth.test.tsx`).
 */

import {
  Children,
  forwardRef,
  isValidElement,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from './SelectMenu';

const EMPTY = '__empty__';
const encode = (value: string) => (value === '' ? EMPTY : value);
const decode = (value: string) => (value === EMPTY ? '' : value);

interface ParsedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

/** `<option>`s anywhere in the children, through fragments and arrays. */
function optionsOf(children: ReactNode): ParsedOption[] {
  const out: ParsedOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{
      value?: string | number;
      children?: ReactNode;
      disabled?: boolean;
    }>;
    if (element.type === 'option') {
      const label = element.props.children;
      out.push({
        value: String(element.props.value ?? (typeof label === 'string' ? label : '')),
        label,
        disabled: element.props.disabled,
      });
    } else if (element.props.children) {
      out.push(...optionsOf(element.props.children));
    }
  });
  return out;
}

interface SelectProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  invalid?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    defaultValue,
    onChange,
    children,
    invalid,
    fullWidth = true,
    disabled,
    required,
    name,
    id,
    className,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  },
  ref,
) {
  const options = optionsOf(children);

  function change(next: string) {
    const decoded = decode(next);
    // Event-shaped, so `(event) => set(event.target.value)` callers work unchanged.
    const target = { value: decoded, name } as HTMLSelectElement;
    onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
  }

  return (
    <div className={cn('relative', fullWidth ? 'w-full' : 'inline-block')}>
      <SelectRoot
        value={value === undefined ? undefined : encode(String(value))}
        defaultValue={defaultValue === undefined ? undefined : encode(String(defaultValue))}
        onValueChange={change}
        disabled={disabled}
        required={required}
        name={name}
      >
        <SelectTrigger
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid || ariaInvalid || undefined}
          className={cn(
            fullWidth ? 'w-full' : 'w-auto',
            invalid && 'border-error',
            'disabled:bg-surface-variant disabled:text-disabled-contrast disabled:opacity-100',
            className,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={encode(option.value)} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  );
});
