/**
 * Presentation. The wire carries numbers and keys; the console formats
 * (BR-110), which is why not one of these functions exists on the server.
 *
 * Two rules that are easy to get wrong and expensive to get wrong:
 *
 *  - **Every date is Colombo-local** (BR-104). A delivery recorded at 23:30
 *    local is that day's delivery, and rendering its UTC timestamp in a grid
 *    moves the row across midnight. Every formatter here pins the time zone.
 *  - **`null` is not `0`** (BR-102). A rate-derived field that is `null` means
 *    the auction result is not in, and it renders as a hyphen, never as
 *    `LKR 0.00`, which is a number the office would have to explain.
 *
 * **They follow the chrome language** (en, si, ta), read at call time, so a screen
 * re-rendered by the language switch formats in the new one. What changes is the words
 * and their order: month names, the date's order (Sinhala writes the year first,
 * `2026 ජූලි 30`), the currency and kilogram labels, the age units. Each comes from the
 * string tables (`format.*`), not from the browser's locale data: ICU names the Sinhala
 * months by the traditional calendar (`ඇසළ` for July) in some versions and not in others,
 * and a bill month must read the same on every machine. What does **not** change is the
 * digits and their grouping, `1,234,567.50` in every language, as the printed slip has
 * them (Tamil locale data would group in lakhs, `12,34,567.50`, which is not how Sri
 * Lanka writes money).
 */

import { CURRENCY_CODE, FACTORY_TIME_ZONE, colomboDayOf } from '@tfd/domain';
import { i18next } from '@/i18n';

/** A `format.*` string in the active language. */
function word(key: string, values?: Record<string, string>): string {
  return i18next.t(key, values);
}

const isEnglish = () => !i18next.language || i18next.language.startsWith('en');

/** What a `null` money or rate field renders as. Not a zero. */
export const NOT_AVAILABLE = '-';

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

const number = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 });

/** `LKR 12,450.00` (`රු. 12,450.00`, `ரூ. 12,450.00`), or `-` when the auction result is not in. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  const formatted = currency.format(value);
  return isEnglish() ? formatted : formatted.replace(CURRENCY_CODE, word('format.currency'));
}

/** Amount without the currency code, for a column whose header already says LKR. */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return decimal.format(value);
}

/** An amount with its sign always shown, `+900.00` or `-1,250.00`: a correction either way. */
export function formatSignedAmount(value: number): string {
  return `${value > 0 ? '+' : ''}${decimal.format(value)}`;
}

/** `1,240.50 kg` (`කි.ග්‍රෑ.`, `கிலோ`). */
export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return `${decimal.format(value)} ${word('format.kg')}`;
}

/** A quantity asked for in kilograms, as typed: `50 kg`, `12.5 kg`. */
export function formatQuantityKg(value: number): string {
  return `${number.format(value)} ${word('format.kg')}`;
}

/** Any other number, grouped the same way in every language: `1,234,567.5`. */
export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return integer.format(value);
}

const percent = new Intl.NumberFormat('en-LK', {
  style: 'percent',
  maximumFractionDigits: 0,
});

/**
 * A 0–1 ratio as a whole percentage: the app-adoption figures (M1, M16).
 *
 * `null` renders as a dash (`-`) and **never as `0%`** (BR-102). The two are different
 * facts: a month in which no request was raised at all has no adoption share, and a
 * console printing zero would report a collapse that did not happen. That distinction is
 * the reason `appRequestShare` is nullable on the wire in the first place.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_AVAILABLE;
  return percent.format(value);
}

/**
 * The Colombo wall clock of an instant, as numbers. Only the parts are taken from
 * `Intl` (pinned to the factory's zone, BR-104); the words come from the string tables.
 */
const colomboParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: FACTORY_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function colomboClock(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = Object.fromEntries(
    colomboParts.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: parts.year ?? '',
    month: Number(parts.month),
    day: parts.day ?? '',
    time: `${parts.hour}:${parts.minute}`,
  };
}

const validMonth = (month: number) => Number.isInteger(month) && month >= 1 && month <= 12;

/** `30 Jul 2026` (`2026 ජූලි 30`, `30 ஜூலை 2026`), in Colombo time. */
export function formatDate(iso: string | null | undefined): string {
  const clock = colomboClock(iso);
  if (!clock) return NOT_AVAILABLE;
  return word('format.date', {
    day: clock.day,
    month: word(`format.month.${clock.month}`),
    monthShort: word(`format.monthShort.${clock.month}`),
    year: clock.year,
  });
}

/** `30 Jul 2026, 14:05`, in Colombo time, on the 24-hour clock in every language. */
export function formatDateTime(iso: string | null | undefined): string {
  const clock = colomboClock(iso);
  if (!clock) return NOT_AVAILABLE;
  return word('format.dateTime', { date: formatDate(iso), time: clock.time });
}

/** `"2026-07"` → `July 2026` (`2026 ජූලි`, `ஜூலை 2026`). Months travel as keys, never as display strings. */
export function formatMonthKey(monthKey: string | null | undefined): string {
  if (!monthKey) return NOT_AVAILABLE;
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || month === undefined || !validMonth(month)) return NOT_AVAILABLE;
  return word('format.monthYear', { month: word(`format.month.${month}`), year: String(year) });
}

/**
 * `4` → `April`. The month on its own, with no year attached.
 *
 * For a setting that is *"every year, in this month"* rather than a date: M14's savings
 * withdrawal window (§21.9). Rendering it as `April 2026` there would read as a one-off.
 */
export function formatMonthName(month: number): string {
  if (!validMonth(month)) return NOT_AVAILABLE;
  return word(`format.month.${month}`);
}

/** `2026-09` → `Sep` (`සැප්`, `செப்.`): a chart's axis, where twelve full names do not fit. */
export function formatMonthShort(monthKey: string): string {
  const month = Number(monthKey.split('-')[1]);
  return validMonth(month) ? word(`format.monthShort.${month}`) : monthKey;
}


/**
 * Today's date in Colombo, `YYYY-MM-DD`. The factory's day, whatever the browser's time
 * zone, because a weighing belongs to the day it was weighed at the factory.
 */
export function colomboToday(now: Date = new Date()): string {
  return colomboDayOf(now);
}

/**
 * `3 h`, `2 d`: how long a queue item has been waiting.
 *
 * Compact because it lives in a table cell next to a name, and the office reads
 * it as an urgency signal rather than a duration.
 */
export function formatAge(hours: number | null | undefined): string {
  // An age the API did not send is absent, not "NaN d" (BR-102).
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return NOT_AVAILABLE;
  if (hours < 1) return word('format.age.underAnHour');
  if (hours < 48) return word('format.age.hours', { n: String(Math.floor(hours)) });
  return word('format.age.days', { n: String(Math.floor(hours / 24)) });
}

/** Hours between an ISO timestamp and now: the input to `formatAge`. */
export function hoursSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}
