/**
 * M7 Credit — the queue gateway.
 *
 * Carries the two client-side guards worth having, both for the same reason M9's
 * note guard exists (§9.3: the form is a courtesy, the server is the authority):
 *
 *  - the **note**, so a clerk who typed three characters is told in the dialog
 *    rather than after a round trip;
 *  - the **ceiling**, so an approval for more than the supplier may draw is
 *    stopped before it becomes a request the server has to refuse.
 *
 * Neither replaces the server's check. `over-ceiling` and `note-required` are
 * answered by the API regardless, because the console can be bypassed.
 */

import {
  creditDecisionSchema,
  type AdminCreditRequest,
  type CreditDecisionBody,
  type CreditRequestQuery,
  type Paged,
} from '@tfd/domain';
import { creditEndpoints } from '../endpoints/credit';
import { ApiError } from '../api/errors';

/** Throws the same code the server would, so both paths render identically. */
function assertDecidable(body: CreditDecisionBody): void {
  const parsed = creditDecisionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'note-required',
      message: 'A decision note is required.',
      details: parsed.error.flatten(),
    });
  }
}

export const creditRepository = {
  /** Oldest first within a status — an inbox is worked front to back. */
  list: (query: CreditRequestQuery = {}): Promise<Paged<AdminCreditRequest>> =>
    creditEndpoints.list({ page: 0, pageSize: 25, status: 'pending', ...query }),

  get: (id: string): Promise<AdminCreditRequest> => creditEndpoints.get(id),

  /**
   * `async` so a validation failure **rejects** rather than throwing
   * synchronously — the same reason M9's does. One code path, one error shape.
   *
   * `available` is passed separately from `body.ceilingSeen` because they answer
   * different questions: the ceiling is what the server compares against to detect
   * a stale screen, and the available headroom is what the *amount* has to fit
   * inside. A supplier can be well under their ceiling and still have nothing left.
   */
  approve: async (
    id: string,
    body: CreditDecisionBody,
    check: { amount: number; available: number },
  ): Promise<AdminCreditRequest> => {
    assertDecidable(body);
    if (check.amount > check.available) {
      throw new ApiError({
        code: 'over-ceiling',
        message: 'The amount asked for is more than this supplier may draw.',
        details: check,
      });
    }
    return creditEndpoints.approve(id, body);
  },

  reject: async (id: string, body: CreditDecisionBody): Promise<AdminCreditRequest> => {
    assertDecidable(body);
    return creditEndpoints.reject(id, body);
  },
};
