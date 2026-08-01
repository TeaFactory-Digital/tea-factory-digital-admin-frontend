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

import type {
  AuditQuery,
  BillQuery,
  ChangeRequestQuery,
  CreditRequestQuery,
  DeliveryQuery,
  InquiryQuery,
  PayoutLineQuery,
  PayoutRunQuery,
  SavingsAccountQuery,
  SupplierQuery,
} from '@tfd/domain';

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

  /**
   * Publishing a month invalidates far more than the month: M3's day summaries
   * lock, the dashboard's cycle badge changes, and the audit trail gains an entry.
   * `months.all` covers this module; the others are invalidated by name at the
   * call site, because a key that swept everything would refetch the registry too.
   */
  months: {
    all: ['months'] as const,
    list: ['months', 'list'] as const,
    detail: (monthKey: string) => ['months', 'detail', monthKey] as const,
    exceptions: (monthKey: string, resolved: boolean | undefined) =>
      ['months', 'exceptions', monthKey, resolved ?? 'any'] as const,
  },

  /**
   * A generation run invalidates the whole module, not one list: every bill in the
   * month is replaced, so a key that only refreshed the run summary would leave the
   * grid showing the previous recomputation's figures beside the new totals.
   */
  bills: {
    all: ['bills'] as const,
    list: (query: BillQuery) => ['bills', 'list', query] as const,
    detail: (id: string) => ['bills', 'detail', id] as const,
    run: (monthKey: string) => ['bills', 'run', monthKey] as const,
  },

  /**
   * Marking one line changes the run's totals, so `payouts.all` is what a mark
   * invalidates — the alternative is a run header reading "3 paid" above a grid
   * showing four.
   */
  payouts: {
    all: ['payouts'] as const,
    list: (query: PayoutRunQuery) => ['payouts', 'list', query] as const,
    detail: (id: string) => ['payouts', 'detail', id] as const,
    lines: (id: string, query: PayoutLineQuery) => ['payouts', 'lines', id, query] as const,
  },

  /**
   * Savings is read-only, so nothing in the module invalidates it — but **publishing
   * a month does**, because that is when a bill's savings deduction becomes a
   * passbook entry. M4's invalidation names this key for that reason.
   */
  savings: {
    all: ['savings'] as const,
    summary: (monthKey: string | undefined) => ['savings', 'summary', monthKey ?? 'latest'] as const,
    accounts: (query: SavingsAccountQuery) => ['savings', 'accounts', query] as const,
    ledger: (supplierId: string) => ['savings', 'ledger', supplierId] as const,
  },

  changeRequests: {
    all: ['change-requests'] as const,
    list: (query: ChangeRequestQuery) => ['change-requests', 'list', query] as const,
    detail: (id: string) => ['change-requests', 'detail', id] as const,
  },

  /**
   * Deciding a credit request invalidates more than the queue, and the extra one is
   * easy to miss: **the supplier**. An approval raises `creditBalances`, which is
   * what the next eligibility read subtracts from the ceiling — so a detail page
   * left open would keep offering headroom that has already been lent (§11.3).
   */
  credit: {
    all: ['credit-requests'] as const,
    list: (query: CreditRequestQuery) => ['credit-requests', 'list', query] as const,
    detail: (id: string) => ['credit-requests', 'detail', id] as const,
  },

  inquiries: {
    all: ['inquiries'] as const,
    list: (query: InquiryQuery) => ['inquiries', 'list', query] as const,
    detail: (id: string) => ['inquiries', 'detail', id] as const,
  },

  audit: {
    all: ['audit'] as const,
    list: (query: AuditQuery) => ['audit', 'list', query] as const,
    forEntity: (entity: string, entityId: string) =>
      ['audit', 'entity', entity, entityId] as const,
  },
} as const;
