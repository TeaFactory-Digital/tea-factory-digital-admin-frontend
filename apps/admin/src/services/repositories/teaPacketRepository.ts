/**
 * M18 Tea packet requests — the queue gateway.
 *
 * Carries the same client-side courtesy as M9's: the note is validated before the
 * request leaves, so a clerk who typed three characters is told in the dialog rather
 * than after a round trip. The server must check too, and answers `note-required`.
 */

import {
  decisionSchema,
  type AdminTeaPacketRequest,
  type DecisionBody,
  type Paged,
  type TeaPacketRequestQuery,
} from '@tfd/domain';
import { teaPacketEndpoints } from '../endpoints/teaPackets';
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

export const teaPacketRepository = {
  /** Oldest first within a status — an inbox is worked front to back. */
  list: (query: TeaPacketRequestQuery = {}): Promise<Paged<AdminTeaPacketRequest>> =>
    teaPacketEndpoints.list({ page: 0, pageSize: 25, status: 'pending', ...query }),

  get: (id: string): Promise<AdminTeaPacketRequest> => teaPacketEndpoints.get(id),

  /** `async` so a validation failure rejects rather than throwing synchronously — see M9. */
  approve: async (id: string, body: DecisionBody): Promise<AdminTeaPacketRequest> => {
    assertDecidable(body);
    return teaPacketEndpoints.approve(id, body);
  },

  reject: async (id: string, body: DecisionBody): Promise<AdminTeaPacketRequest> => {
    assertDecidable(body);
    return teaPacketEndpoints.reject(id, body);
  },
};
