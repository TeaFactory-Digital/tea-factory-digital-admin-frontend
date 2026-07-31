/**
 * Leaf collection arithmetic — the shared half of M3.
 *
 * Shared for the same reason `leafCredit.ts` is: **the console, the API and the
 * app must agree on a kilo figure to the cent.** A day's total that the entry
 * grid, the month close and the supplier's phone each derive separately is three
 * figures the office has to reconcile by hand, and the reconciliation happens at
 * the worst possible moment — after a bill has been published.
 *
 * Two rules travel with these functions:
 *
 *  - **Kilos round to `KG_SCALE`, they do not truncate.** A kilo figure is an
 *    amount the supplier is paid for, not a ceiling they must stay under, so the
 *    money rule ("ceilings truncate, amounts round") puts it on the round side.
 *  - **Every date here is a Colombo-local calendar day** (BR-104). A delivery
 *    weighed at 23:30 local is that day's delivery, and a UTC timestamp would
 *    move it across midnight into a month that may already be published.
 */

import {
  FACTORY_TIME_ZONE,
  KG_SCALE,
  OUTLIER_KG_FLOOR_KG,
  OUTLIER_KG_MULTIPLE,
} from './constants';

const KG_FACTOR = 10 ** KG_SCALE;

/**
 * Round kilos to `KG_SCALE`.
 *
 * Deliberately not `round2` from `money.ts`, even though both are two decimal
 * places today: kilos are `NUMERIC(10,2)` and money is `NUMERIC(14,2)`, and a
 * future change to one scale must not silently follow the other.
 */
export function roundKg(value: number): number {
  return Math.round(value * KG_FACTOR) / KG_FACTOR;
}

/**
 * Is this a kilo figure the database can hold exactly?
 *
 * `12.345` is not: it would be stored as `12.35` and the supplier's bill would
 * disagree with the slip the weighing point handed them. Refused at entry rather
 * than rounded silently, because a rounded weight nobody was told about is the
 * kind of discrepancy that ends in an argument at the counter.
 */
export function isExactKg(value: number): boolean {
  return Number.isFinite(value) && roundKg(value) === value;
}

/** Kilos as they arrive from a scale or a keyboard, before a row has a supplier. */
export interface KgRow {
  supplierId: string;
  kgs: number;
}

export interface CollectionTotals {
  /** Deliveries — a supplier may weigh in twice a day. */
  rowCount: number;
  /** Distinct suppliers, which is the figure the office quotes on the telephone. */
  supplierCount: number;
  totalKgs: number;
  /** Mean kilos per delivery, or `0` with nothing to average. */
  meanKgs: number;
}

/**
 * Totals for a set of rows — the running figures above the entry grid.
 *
 * `supplierCount` and `rowCount` are both here because they answer different
 * questions and the office asks both: "how many growers came in" and "how many
 * times did the scale get used".
 */
export function summariseKgs(rows: readonly KgRow[]): CollectionTotals {
  const totalKgs = roundKg(rows.reduce((sum, row) => sum + row.kgs, 0));
  const supplierCount = new Set(rows.map((row) => row.supplierId)).size;
  return {
    rowCount: rows.length,
    supplierCount,
    totalKgs,
    meanKgs: rows.length === 0 ? 0 : roundKg(totalKgs / rows.length),
  };
}

/**
 * Does this row deserve a second look before it is committed?
 *
 * The failure it exists to catch is `1250` typed for `125.0`, which is invisible
 * in a column of numbers and very visible in next month's bill. It is a
 * **question, not a refusal** — a genuinely heavy load must still be enterable,
 * so the grid asks the clerk to confirm rather than rejecting the figure.
 */
export function isOutlierKg(kgs: number, meanKgs: number): boolean {
  if (kgs <= OUTLIER_KG_FLOOR_KG) return false;
  if (meanKgs <= 0) return false;
  return kgs > meanKgs * OUTLIER_KG_MULTIPLE;
}

/**
 * `"2026-07-14"` → `"2026-07"`.
 *
 * A string operation on purpose. The input is already a Colombo-local calendar
 * day, so parsing it into a `Date` to read the month back out could only
 * introduce a timezone — and would shift the last day of a month into the
 * previous one for anybody running the API in UTC+0.
 */
export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

const colomboDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: FACTORY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * An instant as the Colombo-local calendar day it falls in, `YYYY-MM-DD`.
 *
 * The one conversion in the system that turns a timestamp into a factory day, so
 * "which day's leaf is this" has a single answer for the console, the API and the
 * app (BR-104).
 */
export function colomboDayOf(instant: Date): string {
  return colomboDayFormat.format(instant);
}
