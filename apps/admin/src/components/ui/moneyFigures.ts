/** The figure handling behind `MoneyInput`, kept apart so it can be tested on its own. */

import type { KeyboardEvent } from 'react';

/** `45000.5` to `45,000.5`; the decimal part is left exactly as typed. */
export function groupThousands(plain: string): string {
  const negative = plain.startsWith('-');
  const body = negative ? plain.slice(1) : plain;
  const [whole = '', ...rest] = body.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + grouped + (rest.length > 0 ? `.${rest.join('')}` : '');
}

/** What was typed, back to the plain figure: commas, spaces and letters dropped, one point kept. */
export function plainFigure(typed: string, allowNegative = false): string {
  const negative = allowNegative && typed.trim().startsWith('-');
  const kept = typed.replace(/[^\d.]/g, '');
  const point = kept.indexOf('.');
  const single =
    point < 0 ? kept : kept.slice(0, point + 1) + kept.slice(point + 1).replace(/\./g, '');
  return (negative ? '-' : '') + single;
}

/** The next field in the same dialog, form or page, in tab order. */
export function focusNextField(from: HTMLElement): boolean {
  const scope = from.closest('[role="dialog"], form, [data-enter-scope]') ?? document.body;
  const fields = Array.from(
    scope.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
    ),
  ).filter((field) => field.tabIndex >= 0);
  const next = fields[fields.indexOf(from) + 1];
  if (!next) return false;
  next.focus();
  if (next instanceof HTMLInputElement) next.select();
  return true;
}

/** Enter moves on, as in a money box; for the other boxes of a form filled top to bottom. */
export function enterMovesOn(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
    return;
  if (event.nativeEvent.isComposing) return;
  if (focusNextField(event.currentTarget)) event.preventDefault();
}
