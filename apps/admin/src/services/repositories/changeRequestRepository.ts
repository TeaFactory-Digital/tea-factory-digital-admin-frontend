/**
 * M9 Change requests — the queue gateway.
 *
 * This repository carries the one client-side rule worth having here: the note
 * is validated before the request leaves. Not because the server will not check
 * — it must, and it answers `note-required` — but because a clerk who typed
 * three characters should be told in the dialog rather than after a round trip
 * (§9.3: the form is a courtesy, the server is the authority).
 */

import { decisionSchema, type AdminChangeRequest, type ChangeRequestQuery, type DecisionBody, type Paged } from '@tfd/domain';
import { changeRequestEndpoints } from '../endpoints/changeRequests';
import { ApiError } from '../api/errors';

/** Throws the same code the server would, so both paths render identically. */
function assertDecidable(body: DecisionBody): void {
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'note-required',
      message: 'A decision note is required.',
      details: parsed.error.flatten(),
    });
  }
}

export const changeRequestRepository = {
  /** Oldest first within a status — an inbox is worked front to back. */
  list: (query: ChangeRequestQuery = {}): Promise<Paged<AdminChangeRequest>> =>
    changeRequestEndpoints.list({ page: 0, pageSize: 25, status: 'pending', ...query }),

  get: (id: string): Promise<AdminChangeRequest> => changeRequestEndpoints.get(id),

  /**
   * `async` so a validation failure **rejects** rather than throwing
   * synchronously.
   *
   * Not a style preference. A method that throws before returning a promise is a
   * method whose callers need both a `try` and a `.catch` — and React Query's
   * `mutate` would surface a client-side `note-required` as an uncaught exception
   * while surfacing the server's identical refusal as `mutation.error`. One code
   * path, one shape.
   */
  approve: async (id: string, body: DecisionBody): Promise<AdminChangeRequest> => {
    assertDecidable(body);
    return changeRequestEndpoints.approve(id, body);
  },

  reject: async (id: string, body: DecisionBody): Promise<AdminChangeRequest> => {
    assertDecidable(body);
    return changeRequestEndpoints.reject(id, body);
  },
};
