/**
 * M6 gateway.
 *
 * The client-side guards here are not the control — the server refuses all of this
 * too and it is the authority (§9.3). They exist because the feedback belongs where
 * the clerk is working: a failed payment with no reason should be refused under the
 * field, not after a round trip, and a run prepared for a month that is not published
 * should never leave the browser.
 */

import {
  createPayoutRunSchema,
  markPayoutLineSchema,
  type Paged,
  type PaymentMethod,
  type PayoutLine,
  type PayoutLineMark,
  type PayoutLineQuery,
  type PayoutRun,
  type PayoutRunQuery,
} from '@tfd/domain';
import { payoutEndpoints } from '../endpoints/payouts';
import { ApiError } from '../api/errors';

export const payoutRepository = {
  list: (query: PayoutRunQuery = {}): Promise<Paged<PayoutRun>> =>
    payoutEndpoints.list({ page: 0, pageSize: 50, ...query }),

  get: (id: string): Promise<PayoutRun> => payoutEndpoints.get(id),

  lines: (id: string, query: PayoutLineQuery = {}): Promise<Paged<PayoutLine>> =>
    // A run is a few hundred lines at most, and the office reads it as one list —
    // so the page is large and the filter, not the pager, is what narrows it.
    payoutEndpoints.lines(id, { page: 0, pageSize: 100, ...query }),

  create: async (monthKey: string, method: PaymentMethod): Promise<PayoutRun> => {
    const parsed = createPayoutRunSchema.safeParse({ monthKey, method });
    if (!parsed.success) {
      throw new ApiError({
        code: 'invalid',
        message: 'A payout run needs a month and a payment method.',
        details: parsed.error.flatten(),
      });
    }
    return payoutEndpoints.create(parsed.data.monthKey, parsed.data.method);
  },

  approve: (id: string, note?: string): Promise<PayoutRun> => payoutEndpoints.approve(id, note),

  /**
   * The run as a file, and the bytes are the server's.
   *
   * **Deliberately not composed here**, even though the console is holding the lines
   * already: the grid's account numbers are masked (§20.4) and a payment file cannot be,
   * so the full numbers have to come from an endpoint that audits handing them out. A
   * console-side exporter would be a file of `••••4432`, which is not a payment file — or
   * it would need the unmasked numbers on screen, which is worse.
   */
  file: (id: string): Promise<{ body: string; filename: string }> => payoutEndpoints.file(id),

  /**
   * Reconcile a line.
   *
   * The guard is the asymmetry the schema encodes: a failure needs a reason and a
   * payment does not. "Paid" explains itself; a refused transfer is something the
   * next person picking the run up has to act on, and an empty reason leaves them
   * telephoning the bank to find out what the console already knew.
   */
  mark: async (id: string, lineId: string, body: PayoutLineMark): Promise<PayoutLine> => {
    const parsed = markPayoutLineSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError({
        code: 'note-required',
        message: 'A reason is required when a payment failed.',
        details: parsed.error.flatten(),
      });
    }
    return payoutEndpoints.mark(id, lineId, parsed.data);
  },
};
