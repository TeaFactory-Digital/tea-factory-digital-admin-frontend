/**
 * M17 Audit log gateway. Read-only by contract (BR-502).
 *
 * Used in this milestone as the proof half of AC-09: after a decision in M9, the
 * detail page shows the audit entry the mutation produced. That is not
 * decoration — an approval the office cannot demonstrate was recorded is an
 * approval that will be disputed.
 */

import type { AuditEntry, AuditQuery, Paged } from '@tfd/domain';
import { auditEndpoints } from '../endpoints/audit';

export const auditRepository = {
  /**
   * Newest first — **ordered by the API**, not here.
   *
   * This used to re-sort the page it received, which quietly broke two things: a
   * clerk sorting the grid by any column got the response reordered back under
   * them, and the sort only ever covered the rows in hand, so "oldest first"
   * across 300 entries meant "the oldest of the newest 25". Ordering has to
   * happen where the whole set is, which is the server.
   */
  list: (query: AuditQuery = {}): Promise<Paged<AuditEntry>> =>
    auditEndpoints.list({ page: 0, pageSize: 25, sort: 'at', dir: 'desc', ...query }),

  /** Everything that has happened to one record, for its detail page. */
  forEntity: (entity: string, entityId: string): Promise<Paged<AuditEntry>> =>
    auditRepository.list({ entity, entityId, pageSize: 50 }),
};
