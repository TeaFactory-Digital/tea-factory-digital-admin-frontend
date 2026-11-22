/**
 * A box for rupees (22 November 2026): thousands are grouped while typing (`45,000.50`), so a
 * figure is read at a glance and a slipped zero shows, and Enter moves to the next field the way
 * a paper form is filled down.
 *
 * The value in and out is the **plain** figure (`45000.50`), as every caller and the server
 * already take it; the commas are only what the box shows. Anything but digits, one point
 * and (when allowed) a leading minus is dropped as it is typed.
 */

import { forwardRef, useLayoutEffect, useRef, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { enterMovesOn, groupThousands, plainFigure } from './moneyFigures';
import { Input } from './Input';
import { cn } from '@/lib/cn';

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (plain: string) => void;
  invalid?: boolean;
  allowNegative?: boolean;
  /** Off where Enter already means something (a row saved on Enter). Default on. */
  enterToNext?: boolean;
};

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, allowNegative = false, enterToNext = true, className, onKeyDown, ...rest },
  forwarded,
) {
  const own = useRef<HTMLInputElement | null>(null);
  // Where the caret belongs after the commas move: after the same count of digits.
  const caretDigits = useRef<number | null>(null);
  const shown = groupThousands(value);

  useLayoutEffect(() => {
    const input = own.current;
    const digits = caretDigits.current;
    if (!input || digits === null || document.activeElement !== input) return;
    caretDigits.current = null;
    let seen = 0;
    let position = 0;
    while (position < shown.length && seen < digits) {
      if (/[\d.-]/.test(shown[position]!)) seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  }, [shown]);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.target.value;
    const caret = event.target.selectionStart ?? typed.length;
    caretDigits.current = typed.slice(0, caret).replace(/[^\d.-]/g, '').length;
    onValueChange(plainFigure(typed, allowNegative));
  }

  return (
    <Input
      ref={(node) => {
        own.current = node;
        if (typeof forwarded === 'function') forwarded(node);
        else if (forwarded) forwarded.current = node;
      }}
      inputMode="decimal"
      autoComplete="off"
      className={cn('numeric', className)}
      value={shown}
      onChange={onChange}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && enterToNext) enterMovesOn(event);
      }}
      {...rest}
    />
  );
});
