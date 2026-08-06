/**
 * Presentation. The wire carries numbers and keys; the console formats
 * (BR-110) — which is why not one of these functions exists on the server.
 *
 * Two rules that are easy to get wrong and expensive to get wrong:
 *
 *  - **Every date is Colombo-local** (BR-104). A delivery recorded at 23:30
 *    local is that day's delivery, and rendering its UTC timestamp in a grid
 *    moves the row across midnight. Every formatter here pins the time zone.
 *  - **`null` is not `0`** (BR-102). A rate-derived field that is `null` means
 *    the auction result is not in, and it renders as an em dash — never as
 *    `LKR 0.00`, which is a number the office would have to explain.
 */

import { CURRENCY_CODE, FACTORY_TIME_ZONE, colomboDayOf } from '@tfd/domain';

/** What a `null` money or rate field renders as. Not a zero. */
export const NOT_AVAILABLE = '—';

const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: CURRENCY_CODE,
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimal = new Intl.NumberFormat('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });

/** `LKR 12,450.00`, or `—` when the auction result is not in. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return currency.format(value);
}

/** Amount without the currency code — for a column whose header already says LKR. */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return decimal.format(value);
}

/** `1,240.50 kg`. */
export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return `${decimal.format(value)} kg`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return integer.format(value);
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: FACTORY_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: FACTORY_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const monthFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: FACTORY_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});

/** No year and no timezone: a bare month name for a rule that recurs every year. */
const monthNameFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' });

/** `30 Jul 2026`, in Colombo time. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return NOT_AVAILABLE;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NOT_AVAILABLE : dateFmt.format(date);
}

/** `30 Jul 2026, 14:05`, in Colombo time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NOT_AVAILABLE;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NOT_AVAILABLE : dateTimeFmt.format(date);
}

/** `"2026-07"` → `July 2026`. Months travel as keys, never as display strings. */
export function formatMonthKey(monthKey: string | null | undefined): string {
  if (!monthKey) return NOT_AVAILABLE;
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return NOT_AVAILABLE;
  return monthFmt.format(new Date(Date.UTC(year, month - 1, 15)));
}

/**
 * `4` → `April`. The month on its own, with no year attached.
 *
 * For a setting that is *"every year, in this month"* rather than a date — M14's savings
 * withdrawal window (§21.9). Rendering it as `April 2026` there would read as a one-off.
 */
export function formatMonthName(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) return NOT_AVAILABLE;
  return monthNameFmt.format(new Date(Date.UTC(2000, month - 1, 15)));
}

/**
 * Today, as a Colombo-local `YYYY-MM-DD`.
 *
 * Delegates to `@tfd/domain` rather than formatting here: "which factory day is
 * this instant" has to have exactly one implementation, because the API answers
 * the same question when it stamps a delivery (BR-104).
 */
export function colomboToday(now: Date = new Date()): string {
  return colomboDayOf(now);
}

/**
 * `3 h`, `2 d` — how long a queue item has been waiting.
 *
 * Compact because it lives in a table cell next to a name, and the office reads
 * it as an urgency signal rather than a duration.
 */
export function formatAge(hours: number): string {
  if (hours < 1) return '< 1 h';
  if (hours < 48) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** Hours between an ISO timestamp and now — the input to `formatAge`. */
export function hoursSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}
