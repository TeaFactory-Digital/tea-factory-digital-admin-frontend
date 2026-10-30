/**
 * How long the factory keeps its records: **five years** (Q12, decided 30 October 2026).
 *
 * The financial and supply records (bills, payout records, deliveries, the savings and
 * credit ledgers, requests and change requests, inquiries) are kept for five years after
 * the end of the month they belong to. Nothing is deleted before then, whatever is asked:
 * a supplier's account-deletion request removes the **app account**, not these. The audit
 * trail outlives what it describes.
 *
 * What happens after five years is the backend's scheduled job (BACKEND-TODO #59).
 */

export const RECORD_RETENTION_YEARS = 5;

function shiftMonths(monthKey: string, by: number): string {
  const index = Number(monthKey.slice(0, 4)) * 12 + Number(monthKey.slice(5, 7)) - 1 + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The last month a record of `monthKey` must still be kept in: five years on. */
export function retainedThroughMonthKey(monthKey: string): string {
  return shiftMonths(monthKey, RECORD_RETENTION_YEARS * 12);
}

/** True once a record of `monthKey` has been kept its five years, as at `currentMonthKey`. */
export function isPastRetention(monthKey: string, currentMonthKey: string): boolean {
  return currentMonthKey > retainedThroughMonthKey(monthKey);
}
