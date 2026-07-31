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
  /** Newest first: an audit trail is read from the most recent action backwards. */
  list: async (query: AuditQuery = {}): Promise<Paged<AuditEntry>> => {
    const page = await auditEndpoints.list({ page: 0, pageSize: 25, ...query });
    return { ...page, items: [...page.items].sort((a, b) => b.at.localeCompare(a.at)) };
  },

  /** Everything that has happened to one record, for its detail page. */
  forEntity: (entity: string, entityId: string): Promise<Paged<AuditEntry>> =>
    auditRepository.list({ entity, entityId, pageSize: 50 }),
};
