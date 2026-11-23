/**
 * The bills list beside last month (24 November 2026): each supplier's kilos against the
 * month before, so an unusual bill (a 40% drop, a supplier who stopped) is seen before the
 * month is published, not when the supplier telephones. Pure, so the rules are tested alone.
 */

/** `2026-01` → `2025-12`. */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** A change this large, either way, is worth a second look before publishing. */
export const BIG_CHANGE = 0.3;

export type LastMonthChange =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'change'; ratio: number; big: boolean };

/**
 * This month's kilos against last month's. No bill last month is **new**, not +100%; a
 * month with no leaf both times is nothing to compare.
 */
export function kgChange(thisMonth: number, lastMonth: number | undefined): LastMonthChange {
  if (lastMonth === undefined) return { kind: 'new' };
  if (lastMonth === 0) return thisMonth === 0 ? { kind: 'none' } : { kind: 'new' };
  const ratio = (thisMonth - lastMonth) / lastMonth;
  return { kind: 'change', ratio, big: Math.abs(ratio) >= BIG_CHANGE };
}
