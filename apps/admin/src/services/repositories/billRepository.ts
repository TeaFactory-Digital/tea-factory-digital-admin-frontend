/**
 * M5 gateway.
 *
 * The one guard worth having on the way out is the month key: `generate` recomputes
 * a whole month, and a malformed key would reach the server as a path segment that
 * could match a different month. Everything else about a bill is derived, so there
 * is nothing here for the console to validate — which is the point of a read model.
 *
 * `verifyBill` is the exception, and it reads the other way: it checks a bill the
 * server **sent**. BR-107 says the itemized lines must equal the stated total, and a
 * console that trusted that rather than checking it would render an unbalanced slip
 * as though it were fine — on the one screen where somebody could still catch it.
 */

import {
  deductionsBalance,
  generateBillsSchema,
  type AdminBill,
  type BillListItem,
  type BillMonth,
  type BillQuery,
  type BillRun,
  type Paged,
} from '@tfd/domain';
import { billEndpoints } from '../endpoints/bills';
import { ApiError } from '../api/errors';

export const billRepository = {
  months: (): Promise<BillMonth[]> => billEndpoints.months(),

  list: (query: BillQuery = {}): Promise<Paged<BillListItem>> =>
    billEndpoints.list({ page: 0, pageSize: 50, ...query }),

  get: (id: string): Promise<AdminBill> => billEndpoints.get(id),

  run: (monthKey: string): Promise<BillRun> => billEndpoints.run(monthKey),

  generate: async (monthKey: string): Promise<BillRun> => {
    const parsed = generateBillsSchema.safeParse({ monthKey });
    if (!parsed.success) {
      throw new ApiError({
        code: 'invalid',
        message: 'That is not a month the console can generate bills for.',
        details: parsed.error.flatten(),
      });
    }
    return billEndpoints.generate(parsed.data.monthKey);
  },
};

/**
 * Do this bill's nine deduction lines add up to its stated total (BR-107)?
 *
 * Exported rather than folded into the fetch because the answer belongs on screen:
 * a bill that does not balance must be *shown* as not balancing, next to the column
 * that is wrong. Throwing on it would hide the evidence from the only person who
 * can act on it.
 */
export function billIsBalanced(bill: AdminBill): boolean {
  return deductionsBalance(bill.deductions);
}
