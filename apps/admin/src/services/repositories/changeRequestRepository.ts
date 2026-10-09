/**
 * M9 Change requests: the queue gateway.
 *
 * This repository carries the one client-side rule worth having here: the note
 * is validated before the request leaves. Not because the server will not check
 * (it must, and it answers `note-required`), but because a clerk who typed
 * three characters should be told in the dialog rather than after a round trip
 * (§9.3: the form is a courtesy, the server is the authority).
 */

import {
  decisionSchema,
  type AdminChangeRequest,
  type ChangeRequestQuery,
  type RequestStatus,
  type DecisionBody,
  type Paged,
} from '@tfd/domain';
import { changeRequestEndpoints } from '../endpoints/changeRequests';
import type { StatusAck } from '../api/adapters';
import { ApiError } from '../api/errors';

/** Every state a change request can be in, newest-interest first. */
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

/**
 * A change request **as `GET /admin/change-requests/:id` sends it** → the console's shape.
 *
 * The API sends the decision flat (`decisionNote`, `decidedByName`, no `decidedAt`) and no
 * `attachments` at all. The detail screen read `request.attachments.length` and
 * `request.decision.note`, so every request crashed it ("This screen could not be shown").
 * Both shapes are accepted, so a later API that nests them still works.
 */
function toAdminChangeRequest(served: AdminChangeRequest): AdminChangeRequest {
  const raw = served as AdminChangeRequest & {
    decisionNote?: string | null;
    decidedByName?: string | null;
    decidedById?: string | null;
    decidedAt?: string | null;
  };
  const decision =
    raw.decision ??
    (raw.decisionNote || raw.decidedByName
      ? {
          note: raw.decisionNote ?? '',
          decidedById: raw.decidedById ?? '',
          decidedByName: raw.decidedByName ?? '',
          decidedAt: raw.decidedAt ?? '',
        }
      : null);
  return {
    ...served,
    decision,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  };
}

export const changeRequestRepository = {
  /** Oldest first within a status: an inbox is worked front to back. */
  list: (query: ChangeRequestQuery = {}): Promise<Paged<AdminChangeRequest>> =>
    changeRequestEndpoints.list({ page: 0, pageSize: 25, status: 'pending', ...query }),

  /** One request, by id: the list sweep this needed is gone (**G-06** closed). */
  get: async (id: string): Promise<AdminChangeRequest> =>
    toAdminChangeRequest(await changeRequestEndpoints.get(id)),

  /**
   * `async` so a validation failure **rejects** rather than throwing
   * synchronously.
   *
   * Not a style preference. A method that throws before returning a promise is a
   * method whose callers need both a `try` and a `.catch`, and React Query's
   * `mutate` would surface a client-side `note-required` as an uncaught exception
   * while surfacing the server's identical refusal as `mutation.error`. One code
   * path, one shape.
   */
  approve: async (id: string, body: DecisionBody): Promise<StatusAck<RequestStatus>> => {
    assertDecidable(body);
    return changeRequestEndpoints.approve(id, body);
  },

  reject: async (id: string, body: DecisionBody): Promise<StatusAck<RequestStatus>> => {
    assertDecidable(body);
    return changeRequestEndpoints.reject(id, body);
  },
};
