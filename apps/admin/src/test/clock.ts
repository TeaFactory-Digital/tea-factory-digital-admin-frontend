/**
 * The mock's clock moved past a month's end, to the 10th of the next month (when the
 * factory's slips print). A calculated month is published only once its last day is over
 * (`month-not-ended`, backend 221a1c0), and the tests generate and publish the open month.
 * `resetMockState` (in setup) puts the clock back after each test.
 */

import { setMockNow } from '@/services/mocks/handlers';

export function afterMonthEnds(monthKey: string): void {
  const [year, month] = monthKey.split('-').map(Number);
  setMockNow(new Date(Date.UTC(year!, month!, 10, 6, 0, 0)));
}
