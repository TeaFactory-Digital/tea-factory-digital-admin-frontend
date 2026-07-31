/**
 * Query keys, centralized.
 *
 * Copied verbatim in spirit from the mobile app's `queryKeys.ts`, which
 * admin-console.md calls "a pattern worth copying verbatim". The reason it earns
 * that: invalidation is the hard part of a queue-driven console. After approving
 * a change request, four things are stale — the queue, that request, the
 * supplier whose value changed, and the dashboard counts — and a key spelled
 * inline at the call site is a key someone forgets to invalidate.
 *
 * Hierarchical on purpose: `qk.suppliers.all` invalidates every supplier list
 * and detail, `qk.suppliers.detail(id)` only one.
 */

import type { AuditQuery, ChangeRequestQuery, DeliveryQuery, SupplierQuery } from '@tfd/domain';

export const qk = {
  config: ['config'] as const,

  session: {
    me: ['session', 'me'] as const,
  },

  dashboard: ['dashboard'] as const,

  suppliers: {
    all: ['suppliers'] as const,
    list: (query: SupplierQuery) => ['suppliers', 'list', query] as const,
    detail: (id: string) => ['suppliers', 'detail', id] as const,
  },

  /**
   * A committed session invalidates three things: the day's rows, the day's
   * totals, and the dashboard — whose "today's leaf" card is the same figure a
   * clerk just changed. `deliveries.all` covers the first two.
   */
  deliveries: {
    all: ['deliveries'] as const,
    list: (query: DeliveryQuery) => ['deliveries', 'list', query] as const,
    day: (date: string, collectionPoint: string | undefined) =>
      ['deliveries', 'day', date, collectionPoint ?? null] as const,
  },

  changeRequests: {
    all: ['change-requests'] as const,
    list: (query: ChangeRequestQuery) => ['change-requests', 'list', query] as const,
    detail: (id: string) => ['change-requests', 'detail', id] as const,
  },

  audit: {
    all: ['audit'] as const,
    list: (query: AuditQuery) => ['audit', 'list', query] as const,
    forEntity: (entity: string, entityId: string) =>
      ['audit', 'entity', entity, entityId] as const,
  },
} as const;
