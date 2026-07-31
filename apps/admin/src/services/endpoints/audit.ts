/**
 * M17 Audit log — who did what.
 *
 * Read-only by contract: append-only, never updated or deleted (BR-502), and it
 * outlives everything it describes (§20.4). There is deliberately no write
 * method on this module — the console never posts an audit entry, because an
 * audit trail the client can author is not evidence of anything. Entries are a
 * side effect of the mutation that caused them, recorded server-side.
 *
 * AC-09 is the acceptance criterion this serves: every approve, reject, rate
 * change, publish and payout appears here within one second, with actor and
 * before/after.
 */

import type { AuditEntry, AuditQuery, Paged } from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const auditEndpoints = {
  list: (query: AuditQuery) =>
    apiClient
      .get<Paged<AuditEntry>>('/admin/audit', { params: toParams(query) })
      .then((response) => response.data),
};
