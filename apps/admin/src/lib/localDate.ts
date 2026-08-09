/**
 * The one boundary between the console's date **strings** and the `Date` objects the
 * calendar works in.
 *
 * Everything in this console carries a date as a Colombo-local `YYYY-MM-DD`: the query
 * parameter on the deliveries grid, `colomboDayOf`, the month lock, the bill's month key.
 * `react-day-picker` works in `Date`, which is an instant. Converting between the two is
 * where a day gets lost, so it happens here and nowhere else.
 *
 * **The bug being avoided is BR-104's.** `new Date('2026-08-09')` parses as *UTC*
 * midnight, which in Colombo is already half past five in the morning — but for a browser
 * anywhere west of Greenwich it is the evening of the **8th**. A clerk on a laptop still
 * set to another timezone would file a morning weighing under the previous day, and the
 * grid would look right to them and wrong to everyone else.
 *
 * Its own file rather than sitting beside `<Calendar>` because a module that exports both
 * a component and helpers loses fast refresh for the component.
 */

/**
 * `YYYY-MM-DD` → a `Date` at **local noon**.
 *
 * Noon, not midnight: it puts twelve hours of clearance on either side, so no offset in
 * use anywhere can push the value across a day boundary. Midnight minus any offset is the
 * previous day, which is precisely the failure above.
 */
export function toLocalDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day, 12);
  // `new Date(2026, 1, 31)` silently rolls forward to 3 March. A half-typed value in the
  // text field must read as "nothing chosen yet" rather than as a date nobody entered.
  return date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

/** A `Date` → `YYYY-MM-DD`, read in the browser's own calendar rather than in UTC. */
export function fromLocalDate(date: Date | undefined): string {
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
