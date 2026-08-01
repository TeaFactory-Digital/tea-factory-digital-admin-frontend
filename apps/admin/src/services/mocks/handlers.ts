/**
 * MSW handlers — the stand-in API.
 *
 * Written as an **executable specification** of `docs/api-contract.md`, not as a
 * convenience. Every refusal below is a refusal the real backend must reproduce,
 * and the console's error handling is only tested because these exist:
 *
 *  - `403 forbidden` from a **server-side** capability check. The console hides
 *    what a role cannot do as a courtesy; this is the authority (§12.1).
 *  - `409 four-eyes-violation` when the approver created the record (BR-501).
 *  - `409 already-decided` when two clerks work the same inbox.
 *  - `422 note-required` on a decision without one (AC-06).
 *  - `403 feature-disabled` for a surface this tenant has turned off (AC-07).
 *
 * Paths use a leading `*` so they match whatever `VITE_API_BASE_URL` is set to,
 * including the `/v1` prefix. First match wins, so specific routes come first.
 */

import { HttpResponse, delay, http, type HttpHandler } from 'msw';
import type {
  AdminChangeRequest,
  AdminSupplier,
  AuditEntry,
  Capability,
  ConsoleUser,
  Delivery,
  DeliveryBatch,
  DeliveryBatchResult,
  DeliveryRejection,
  MonthCycleStage,
  MonthException,
  MonthSummary,
  MonthlyRateEntry,
  Paged,
} from '@tfd/domain';
import {
  MAX_DELIVERY_BATCH_ROWS,
  MAX_DELIVERY_KG,
  can,
  isExactKg,
  isSelfApproval,
  monthKeyOf,
  roundKg,
  summariseKgs,
} from '@tfd/domain';
import {
  MOCK_MFA_CODE,
  MOCK_PASSWORD,
  TODAY,
  buildDashboard,
  mockAudit,
  mockChangeRequests,
  mockConfigs,
  mockDeliveries,
  mockMonthExceptions,
  mockMonths,
  monthStageOf,
  mockFullAccountNumbers,
  mockSuppliers,
  mockUsers,
  summariseDay,
  toListItem,
  type MockUser,
  type MonthRecord,
} from './seed';

/* ────────────────────────────── mutable state ────────────────────────────── */

/**
 * The mock's state lives in module scope, so it survives navigation but not a
 * reload — the same property the mobile app's `mockDb` has, and the same caveat:
 * **writes do not survive a refresh.** That is a feature for a demo (the fixture
 * is always the same) and a trap in a manual test, so it is stated in
 * docs/mocks.md rather than discovered.
 */
const state = {
  suppliers: mockSuppliers,
  changeRequests: mockChangeRequests,
  deliveries: mockDeliveries,
  audit: [...mockAudit],
  /** access token → user id. */
  sessions: new Map<string, string>(),
  /** challenge token → user id, for the MFA step. */
  challenges: new Map<string, string>(),
  /**
   * Committed batches, by the id the console generated.
   *
   * This is the mock's idempotency store, and it is here because the failure it
   * prevents is the worst one in M3: a clerk whose connection dropped mid-commit
   * clicks again, and sixty deliveries are recorded twice. The real API must key
   * on `Idempotency-Key` the same way (§1.3).
   */
  batches: new Map<string, DeliveryBatchResult>(),
  /**
   * The months, keyed by `monthKey`.
   *
   * Here rather than derived from the calendar because **publishing is state**:
   * M4 closes a month, and from that moment M3 must refuse leaf in it (BR-108).
   * A stage recomputed per request would revert the publish on the next call.
   */
  months: cloneMonths(),
  monthExceptions: mockMonthExceptions.map((e) => ({ ...e })),
  sequence: 1000,
};

/**
 * A per-record copy of the month fixture.
 *
 * `{ ...mockMonths }` would be a **shallow** copy: the `MonthRecord` objects would
 * be shared with the seed, so publishing a month would mutate the fixture itself
 * and `resetMockState()` would hand the mutated object straight back. The symptom
 * is a test suite where the second test finds no open month.
 */
function cloneMonths(): Record<string, MonthRecord> {
  return Object.fromEntries(
    Object.entries(mockMonths).map(([key, record]) => [
      key,
      { ...record, rate: record.rate ? { ...record.rate } : null },
    ]),
  );
}

/**
 * The live stage of a month.
 *
 * Falls back to the calendar for a month outside the fixture's window — a clerk
 * scrolling back two years should see "published", not a month with no state.
 */
function stageOf(monthKey: string): MonthCycleStage {
  return state.months[monthKey]?.stage ?? monthStageOf(monthKey);
}

function lockedMonth(monthKey: string): boolean {
  return stageOf(monthKey) === 'published';
}

/**
 * The record for a month the API knows about, or `null`.
 *
 * Deliberately **not** materialized on demand. An earlier version created a record
 * for whatever arrived in the path, which meant a typo'd or stale `?month=` — or a
 * key from another screen's select — rendered a plausible published month with zero
 * leaf in it. A month the factory has no records for is a `404`, not an empty one.
 */
function monthRecord(monthKey: string): MonthRecord | null {
  return state.months[monthKey] ?? null;
}

/** `404` for a month outside the records, so no screen can invent one. */
function noSuchMonth(monthKey: string) {
  return fail({
    status: 404,
    code: '404',
    message: `No records for ${monthKey}.`,
    details: { monthKey },
  });
}

/**
 * A month as the close screen reads it.
 *
 * Totals come from the delivery rows, never from a stored figure: the leaf is the
 * fact every money number is derived from (§16), and a cached total is a second
 * answer waiting to disagree with it.
 */
function monthSummary(record: MonthRecord): MonthSummary {
  const monthKey = record.monthKey;
  const rows = state.deliveries.filter((row) => row.monthKey === monthKey && !row.voidedAt);
  const totals = summariseKgs(rows.map((row) => ({ supplierId: row.supplierId, kgs: row.kgs })));
  const exceptions = state.monthExceptions.filter((e) => e.monthKey === monthKey);

  return {
    monthKey,
    stage: record.stage,
    openExceptions: exceptions.filter((e) => e.resolvedAt === null).length,
    totalExceptions: exceptions.length,
    ratePerKg: record.rate?.ratePerKg ?? null,
    extraRatePerKg: record.rate?.extraRatePerKg ?? null,
    publishedAt: record.publishedAt,
    publishedByName: record.publishedByName,
    rate: record.rate,
    totalKgs: totals.totalKgs,
    supplierCount: totals.supplierCount,
    deliveryCount: totals.rowCount,
    open: record.stage !== 'published',
  };
}

const nextId = () => String(++state.sequence);

/** Latency worth having: it is what makes a missing loading state visible. */
const LATENCY_MS = 180;

/* ─────────────────────── the stand-in refresh cookie ─────────────────────── */

/**
 * The mock's substitute for the httpOnly refresh cookie.
 *
 * Without it, reloading the page signs you out: the console holds its access
 * token in memory (by design — see `authStore`), so on a fresh document it asks
 * `POST /admin/auth/refresh` to recover the session. The real API answers from a
 * rotating httpOnly cookie that survives the reload. The mock's session map is
 * module state, which does not — so every refresh bounced the developer back to
 * sign-in, and the console looked broken when it was behaving correctly.
 *
 * `sessionStorage` is the closest honest analogue: scoped to the tab, cleared
 * when it closes. It holds a **mock user id, not a credential**, and this module
 * is eliminated from production builds entirely.
 */
const REFRESH_KEY = 'tfd.mock.refresh';

function readRefreshCookie(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    // Vitest's jsdom, or a browser with storage blocked. Falls back to the
    // in-memory map, which is all a test needs.
    return null;
  }
}

function writeRefreshCookie(userId: string | null): void {
  try {
    if (userId) sessionStorage.setItem(REFRESH_KEY, userId);
    else sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    // Ignored, as above.
  }
}

/** Issue an access token and remember the session both ways. */
function issueSession(user: MockUser) {
  const accessToken = `mock-access-${user.id}-${nextId()}`;
  state.sessions.set(accessToken, user.id);
  writeRefreshCookie(user.id);
  return {
    accessToken,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

/* ──────────────────────────────── helpers ──────────────────────────────── */

interface ErrorOptions {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/** The §17.4 envelope, and nothing else. */
function fail({ status, code, message, details }: ErrorOptions) {
  return HttpResponse.json({ code, message, details }, { status });
}

function bearer(request: Request): MockUser | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const userId = state.sessions.get(header.slice(7));
  return mockUsers.find((u) => u.id === userId) ?? null;
}

/**
 * Authenticate and authorize in one step.
 *
 * Returns either the user or the response to send. Written this way so a handler
 * cannot forget the check and still compile into something that answers `200`.
 */
function authorize(
  request: Request,
  capability: Capability,
  level: 'read' | 'write' | 'approve' = 'read',
): { user: MockUser } | { response: Response } {
  const user = bearer(request);
  if (!user) {
    return {
      response: fail({ status: 401, code: 'unauthenticated', message: 'Sign in required.' }),
    };
  }
  if (!can(user.grants, capability, level)) {
    return {
      response: fail({
        status: 403,
        code: 'forbidden',
        message: `Your role cannot ${level} ${capability}.`,
        details: { capability, required: level, granted: user.grants[capability] ?? 'none' },
      }),
    };
  }
  return { user };
}

function tenantOf(request: Request): string {
  return request.headers.get('X-Tenant') ?? 'galaboda';
}

/** A tenant's flags, so `feature-disabled` can be answered the way AC-07 needs. */
function flagsOf(request: Request) {
  return (mockConfigs[tenantOf(request)] ?? mockConfigs.galaboda!).flags;
}

function paginate<T>(items: T[], url: URL): Paged<T> {
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') ?? 50)));
  const start = page * pageSize;
  const slice = items.slice(start, start + pageSize);
  const hasMore = start + pageSize < items.length;
  return { items: slice, page, pageSize, total: items.length, nextPage: hasMore ? page + 1 : null };
}

/**
 * Sort a result set by the column the grid asked for.
 *
 * Server-side because the grid is server-paged: sorting page 3 of 84 suppliers in
 * the browser sorts *that page*, which is the bug where a clerk sorts by code and
 * the first row is 5301 (admin-console.md §18.2).
 *
 * Returns a copy. `state.audit` is handed out unfiltered when no filter is set, and
 * an in-place sort would reorder the mock's own log as a side effect of reading it.
 *
 * `fallback` keeps each list's own default order — oldest-first for a queue,
 * newest-first for a log — so "no sort" is not silently "sorted by whatever the
 * fixture order happens to be".
 */
function sortRows<T>(rows: T[], url: URL, fallback: (a: T, b: T) => number): T[] {
  const sort = url.searchParams.get('sort');
  if (!sort) return [...rows].sort(fallback);

  const dir = url.searchParams.get('dir') === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = (a as Record<string, unknown>)[sort];
    const right = (b as Record<string, unknown>)[sort];
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * dir;
    // `localeCompare` rather than `<`: supplier codes carry a division suffix and
    // actor names are Sinhala-transliterated, and both sort wrongly by code point.
    return String(left ?? '').localeCompare(String(right ?? '')) * dir;
  });
}

/**
 * `record`, with the actor filled in from the authorized user.
 *
 * Every M4 mutation writes one, and the entry is the module's whole defence: a
 * month that closed on a rate somebody typed is a decision an auditor will ask
 * about by name six months later (AC-09).
 */
function recordBy(
  auth: { user: MockUser },
  action: string,
  entity: string,
  entityId: string,
  change: { before?: unknown; after?: unknown },
): AuditEntry {
  return record({
    actorId: auth.user.id,
    actorName: auth.user.name,
    action,
    entity,
    entityId,
    before: change.before,
    after: change.after,
  });
}

function record(entry: Omit<AuditEntry, 'id' | 'at' | 'ip'>): AuditEntry {
  const created: AuditEntry = {
    ...entry,
    id: `aud-${nextId()}`,
    at: new Date().toISOString(),
    ip: '192.168.10.24',
  };
  state.audit.unshift(created);
  return created;
}

function publicUser(user: MockUser): ConsoleUser {
  const { password: _password, grants: _grants, ...rest } = user;
  return rest;
}

/** Re-derives `ageHours` at read time, so a queue row's urgency is never stale. */
function withAge(request: AdminChangeRequest): AdminChangeRequest {
  return {
    ...request,
    ageHours: (Date.now() - new Date(request.createdAt).getTime()) / 3_600_000,
  };
}

/* ──────────────────────────────── handlers ──────────────────────────────── */

export const handlers: HttpHandler[] = [
  /* ── Tenant config: public, per subdomain ──────────────────────────────── */
  http.get('*/config', async ({ request }) => {
    await delay(LATENCY_MS);
    const config = mockConfigs[tenantOf(request)];
    if (!config) {
      return fail({ status: 404, code: 'tenant-unknown', message: 'No such factory.' });
    }
    return HttpResponse.json(config, { headers: { ETag: `"cfg-${config.tenantId}-1"` } });
  }),

  /* ── Auth ──────────────────────────────────────────────────────────────── */
  http.post('*/admin/auth/login', async ({ request }) => {
    await delay(LATENCY_MS * 2); // login is deliberately the slowest call
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = mockUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    // One message for both wrong-user and wrong-password: a login form that
    // distinguishes them is an account enumeration oracle.
    if (!user || password !== MOCK_PASSWORD) {
      return fail({ status: 401, code: 'invalid', message: 'Email or password is incorrect.' });
    }
    if (user.status !== 'active') {
      return fail({ status: 403, code: 'forbidden', message: 'This account is suspended.' });
    }

    if (user.mfaEnrolled) {
      const challengeToken = `mock-challenge-${nextId()}`;
      state.challenges.set(challengeToken, user.id);
      return HttpResponse.json({
        status: 'mfaRequired',
        challenge: { challengeToken, method: 'totp' },
      });
    }

    return HttpResponse.json({
      status: 'authenticated',
      session: { ...issueSession(user), user: publicUser(user), grants: user.grants },
    });
  }),

  http.post('*/admin/auth/mfa', async ({ request }) => {
    await delay(LATENCY_MS);
    const { challengeToken, code } = (await request.json()) as {
      challengeToken: string;
      code: string;
    };
    const userId = state.challenges.get(challengeToken);
    if (!userId) {
      return fail({ status: 401, code: 'mfa-invalid', message: 'Challenge expired. Sign in again.' });
    }
    if (code !== MOCK_MFA_CODE) {
      return fail({ status: 401, code: 'mfa-invalid', message: 'That code is not correct.' });
    }
    // Single-use: a replayed challenge is a replayed second factor.
    state.challenges.delete(challengeToken);

    const user = mockUsers.find((u) => u.id === userId)!;
    return HttpResponse.json({
      session: { ...issueSession(user), user: publicUser(user), grants: user.grants },
    });
  }),

  /**
   * Refresh — the mock's stand-in for the rotating httpOnly cookie.
   *
   * It reads `sessionStorage` first, so a **page reload keeps you signed in**,
   * which is what the real API does and what the console's in-memory access
   * token depends on. Falling back to the in-memory map keeps Vitest working,
   * where there is no storage worth using.
   *
   * Still less strict than the contract in one way: no rotation and no reuse
   * detection. Those need the real backend (see docs/mocks.md).
   */
  http.post('*/admin/auth/refresh', async () => {
    await delay(LATENCY_MS);

    const userId = readRefreshCookie() ?? [...state.sessions.values()][0];
    const user = userId ? mockUsers.find((u) => u.id === userId) : undefined;
    if (!user) {
      return fail({ status: 401, code: 'invalid', message: 'No refresh token.' });
    }

    return HttpResponse.json(issueSession(user));
  }),

  http.post('*/admin/auth/logout', async ({ request }) => {
    const header = request.headers.get('Authorization');
    if (header?.startsWith('Bearer ')) state.sessions.delete(header.slice(7));
    // Signing out must clear the stand-in cookie too, or the next reload would
    // silently sign the clerk back in — on a shared office machine, the exact
    // failure sign-out exists to prevent.
    writeRefreshCookie(null);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/admin/auth/me', async ({ request }) => {
    await delay(LATENCY_MS);
    const user = bearer(request);
    if (!user) {
      return fail({ status: 401, code: 'unauthenticated', message: 'Sign in required.' });
    }
    return HttpResponse.json({ user: publicUser(user), grants: user.grants });
  }),

  /* ── M1 Dashboard ──────────────────────────────────────────────────────── */
  http.get('*/admin/dashboard', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'reports');
    if ('response' in auth) return auth.response;

    const summary = buildDashboard(state.changeRequests, state.deliveries);
    const flags = flagsOf(request);

    /**
     * A queue for a disabled facility is not shown as empty — it is not shown.
     * "Otherwise a clerk is staffing an inbox nothing can reach"
     * (white-label.md → Feature flags are a backend concern too).
     */
    return HttpResponse.json({
      ...summary,
      queues: summary.queues.filter((q) => {
        if (q.queue === 'advanceRequests') return flags.enableAdvances;
        if (q.queue === 'loanRequests') return flags.enableLoans;
        if (q.queue === 'manureRequests') return flags.enableManure;
        if (q.queue === 'inquiries') return flags.enableInquiry;
        return true;
      }),
    });
  }),

  /* ── M2 Suppliers ──────────────────────────────────────────────────────── */
  http.get('*/admin/suppliers', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'suppliers');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const status = url.searchParams.get('status');
    const point = url.searchParams.get('collectionPoint');
    const hasBankDetails = url.searchParams.get('hasBankDetails');

    let rows = state.suppliers.map(toListItem);

    if (q) {
      // Tolerates the division suffix: "5708" matches "5708 (MAKADURA)", and so
      // does "makadura" — the office searches by whichever it remembers.
      rows = rows.filter(
        (s) =>
          s.supplierCode.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.nic.toLowerCase().includes(q),
      );
    }
    if (status) rows = rows.filter((s) => s.status === status);
    if (point) rows = rows.filter((s) => s.collectionPoint === point);
    if (hasBankDetails !== null) {
      rows = rows.filter((s) => s.hasBankDetails === (hasBankDetails === 'true'));
    }

    // The registry's default is the code, which is how the office refers to a
    // supplier and how the paper ledgers it replaced were ordered.
    rows = sortRows(rows, url, (a, b) => a.supplierCode.localeCompare(b.supplierCode));

    return HttpResponse.json(paginate(rows, url));
  }),

  http.get('*/admin/suppliers/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'suppliers');
    if ('response' in auth) return auth.response;

    const supplier = state.suppliers.find((s) => s.id === params.id);
    if (!supplier) {
      return fail({ status: 404, code: '404', message: 'No such supplier.' });
    }
    return HttpResponse.json(supplier);
  }),

  http.patch('*/admin/suppliers/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    // `write`, not `read` — this is where a manager is correctly refused: the
    // §12.1 matrix gives them `R` on supplier records, not `W`.
    const auth = authorize(request, 'suppliers', 'write');
    if ('response' in auth) return auth.response;

    const index = state.suppliers.findIndex((s) => s.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such supplier.' });

    const before = state.suppliers[index]!;
    const patch = (await request.json()) as Partial<AdminSupplier>;
    const after = { ...before, ...patch };
    state.suppliers[index] = after;

    record({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'supplier.update',
      entity: 'supplier',
      entityId: before.id,
      before: Object.fromEntries(Object.keys(patch).map((k) => [k, (before as never)[k]])),
      after: patch,
    });

    return HttpResponse.json(after);
  }),

  http.post('*/admin/suppliers/:id/suspend', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'suppliers', 'write');
    if ('response' in auth) return auth.response;

    const { reason } = (await request.json()) as { reason?: string };
    if (!reason || reason.trim().length < 10) {
      return fail({ status: 422, code: 'note-required', message: 'A reason is required.' });
    }

    const index = state.suppliers.findIndex((s) => s.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such supplier.' });

    const before = state.suppliers[index]!;
    const after: AdminSupplier = { ...before, status: 'suspended', suspendedReason: reason };
    state.suppliers[index] = after;

    record({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'supplier.suspend',
      entity: 'supplier',
      entityId: before.id,
      before: { status: before.status },
      after: { status: 'suspended', reason },
    });

    return HttpResponse.json(after);
  }),

  http.post('*/admin/suppliers/:id/reactivate', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'suppliers', 'write');
    if ('response' in auth) return auth.response;

    const { reason } = (await request.json()) as { reason?: string };
    if (!reason || reason.trim().length < 10) {
      return fail({ status: 422, code: 'note-required', message: 'A reason is required.' });
    }

    const index = state.suppliers.findIndex((s) => s.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such supplier.' });

    const before = state.suppliers[index]!;
    const after: AdminSupplier = { ...before, status: 'active', suspendedReason: undefined };
    state.suppliers[index] = after;

    record({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'supplier.reactivate',
      entity: 'supplier',
      entityId: before.id,
      before: { status: before.status },
      after: { status: 'active', reason },
    });

    return HttpResponse.json(after);
  }),

  /**
   * The audited reveal (§20.4).
   *
   * Note what it returns: the number **and** the id of the audit entry the reveal
   * produced. The console shows that id to the clerk, which is the difference
   * between "we log this" as a policy statement and as something the person
   * looking at the number can see happening.
   */
  http.post('*/admin/suppliers/:id/bank-details/reveal', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'suppliers');
    if ('response' in auth) return auth.response;

    const { reason } = (await request.json()) as { reason?: string };
    if (!reason || reason.trim().length < 10) {
      return fail({
        status: 422,
        code: 'note-required',
        message: 'A reason is required to view a full account number.',
      });
    }

    const supplier = state.suppliers.find((s) => s.id === params.id);
    const full = mockFullAccountNumbers.get(String(params.id));
    if (!supplier || !full || !supplier.bankDetails) {
      return fail({ status: 404, code: '404', message: 'No bank details on file.' });
    }

    const entry = record({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'supplier.bankDetails.reveal',
      entity: 'supplier',
      entityId: supplier.id,
      after: { reason },
    });

    return HttpResponse.json({
      bankName: supplier.bankDetails.bankName,
      branchName: supplier.bankDetails.branchName,
      accountNumber: full,
      auditId: entry.id,
    });
  }),

  /* ── M3 Leaf collection ────────────────────────────────────────────────── */

  /**
   * The day's totals. Registered **before** the list route so the literal path
   * wins: first match wins, and the wildcard list pattern would otherwise swallow
   * `/deliveries/summary` and answer it with a page of rows.
   */
  http.get('*/admin/deliveries/summary', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'deliveries');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? TODAY;
    const point = url.searchParams.get('collectionPoint');

    return HttpResponse.json(summariseDay(state.deliveries, date, point, stageOf(monthKeyOf(date))));
  }),

  http.get('*/admin/deliveries', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'deliveries');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const point = url.searchParams.get('collectionPoint');
    const supplierId = url.searchParams.get('supplierId');
    const includeVoided = url.searchParams.get('includeVoided') === 'true';

    let rows = state.deliveries;
    if (date) rows = rows.filter((row) => row.date === date);
    if (from) rows = rows.filter((row) => row.date >= from);
    if (to) rows = rows.filter((row) => row.date <= to);
    if (point) rows = rows.filter((row) => row.collectionPoint === point);
    if (supplierId) rows = rows.filter((row) => row.supplierId === supplierId);
    // A voided row is evidence, not data (§12.1) — it is returned when asked for
    // and never by default, so a day's total and its list agree.
    if (!includeVoided) rows = rows.filter((row) => row.voidedAt === null);

    // Newest first: a clerk watches the row they just entered arrive at the top.
    rows = sortRows(rows, url, (a, b) => b.recordedAt.localeCompare(a.recordedAt));

    return HttpResponse.json(paginate(rows, url));
  }),

  /**
   * Commit a weighing session — one request for the whole grid
   * (api-contract.md §9.3).
   *
   * Three refusals, and which kind each is matters:
   *
   *  - `409 month-locked` for the **whole batch**: a published month is immutable
   *    (BR-108), so there is nothing to partially accept.
   *  - `422 batch-too-large` for the whole batch, before anything is recorded.
   *  - **Per-row rejections inside a `200`** for everything else. All-or-nothing
   *    would send sixty good rows back to be re-typed because one code was wrong.
   */
  http.post('*/admin/deliveries', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'deliveries', 'write');
    if ('response' in auth) return auth.response;

    const batch = (await request.json()) as DeliveryBatch;
    const monthKey = monthKeyOf(batch.date);

    /**
     * Idempotency, keyed on the session's own id (§1.3).
     *
     * The failure this prevents is the worst one in M3: a clerk whose connection
     * dropped mid-commit clicks again and sixty deliveries are recorded twice.
     * The original result is replayed instead — including its rejections, because
     * a second answer that differed would be a second thing to reconcile.
     */
    const replay = state.batches.get(batch.batchId);
    if (replay) return HttpResponse.json(replay);

    if (lockedMonth(monthKey)) {
      return fail({
        status: 409,
        code: 'month-locked',
        message: `${monthKey} is published and can no longer be changed.`,
        details: { monthKey },
      });
    }

    if (batch.rows.length > MAX_DELIVERY_BATCH_ROWS) {
      return fail({
        status: 422,
        code: 'batch-too-large',
        message: `A session carries at most ${MAX_DELIVERY_BATCH_ROWS} rows.`,
        details: { limit: MAX_DELIVERY_BATCH_ROWS, submitted: batch.rows.length },
      });
    }

    const accepted: Delivery[] = [];
    const rejected: DeliveryRejection[] = [];

    batch.rows.forEach((row, index) => {
      const supplier = state.suppliers.find((s) => s.id === row.supplierId);
      if (!supplier) {
        rejected.push({
          index,
          supplierId: row.supplierId,
          code: 'supplier-unknown',
          message: 'No supplier with that code.',
        });
        return;
      }
      if (supplier.status !== 'active') {
        // Not a courtesy check: leaf recorded against a closed account becomes a
        // bill nobody can be paid for.
        rejected.push({
          index,
          supplierId: row.supplierId,
          code: 'supplier-inactive',
          message: `${supplier.supplierCode} is ${supplier.status}.`,
        });
        return;
      }
      if (!isExactKg(row.kgs) || row.kgs <= 0 || row.kgs > MAX_DELIVERY_KG) {
        rejected.push({
          index,
          supplierId: row.supplierId,
          code: 'invalid-kg',
          message: `Kilos must be between 0 and ${MAX_DELIVERY_KG}, to two decimals.`,
        });
        return;
      }

      accepted.push({
        id: `del-${nextId()}`,
        date: batch.date,
        monthKey,
        supplierId: supplier.id,
        supplierCode: supplier.supplierCode,
        supplierName: supplier.name,
        // Where it was **weighed**, which is the session's point — not the
        // supplier's registered one. A grower may deliver anywhere.
        collectionPoint: batch.collectionPoint,
        kgs: roundKg(row.kgs),
        source: 'manual',
        batchId: batch.batchId,
        recordedById: auth.user.id,
        recordedByName: auth.user.name,
        recordedAt: new Date().toISOString(),
        voidedAt: null,
        voidedByName: null,
        voidedReason: null,
      });
    });

    state.deliveries = [...accepted, ...state.deliveries];

    if (accepted.length > 0) {
      record({
        actorId: auth.user.id,
        actorName: auth.user.name,
        action: 'delivery.batch.commit',
        entity: 'deliveryBatch',
        entityId: batch.batchId,
        after: {
          date: batch.date,
          collectionPoint: batch.collectionPoint,
          rows: accepted.length,
          totalKgs: summariseKgs(accepted).totalKgs,
        },
      });
    }

    const result: DeliveryBatchResult = {
      accepted,
      rejected,
      // The day's figures as the **server** has them after the commit, so the
      // running totals above the grid are never the console's own addition.
      day: summariseDay(state.deliveries, batch.date, batch.collectionPoint, stageOf(monthKey)),
    };
    state.batches.set(batch.batchId, result);
    return HttpResponse.json(result);
  }),

  /**
   * Void, never delete (§12.1). The row survives with who withdrew it and why.
   */
  http.post('*/admin/deliveries/:id/void', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'deliveries', 'write');
    if ('response' in auth) return auth.response;

    const { reason } = (await request.json()) as { reason?: string };
    const index = state.deliveries.findIndex((row) => row.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such delivery.' });

    const before = state.deliveries[index]!;

    if (lockedMonth(before.monthKey)) {
      return fail({
        status: 409,
        code: 'month-locked',
        message: `${before.monthKey} is published and can no longer be changed.`,
        details: { monthKey: before.monthKey },
      });
    }
    if (before.voidedAt !== null) {
      return fail({
        status: 409,
        code: 'already-voided',
        message: 'This delivery was already voided.',
      });
    }
    if (!reason || reason.trim().length < 10) {
      return fail({ status: 422, code: 'note-required', message: 'A reason is required.' });
    }

    const after: Delivery = {
      ...before,
      voidedAt: new Date().toISOString(),
      voidedByName: auth.user.name,
      voidedReason: reason.trim(),
    };
    state.deliveries[index] = after;

    record({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'delivery.void',
      entity: 'delivery',
      entityId: before.id,
      before: { kgs: before.kgs, voidedAt: null },
      after: { kgs: after.kgs, voidedAt: after.voidedAt, reason: after.voidedReason },
    });

    return HttpResponse.json(after);
  }),

  /* ── M4 Rates & month close ────────────────────────────────────────────── */

  http.get('*/admin/months', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    // Newest first, and the month in progress is the one the office works in.
    const rows = Object.keys(state.months)
      .sort()
      .reverse()
      .map((key) => monthSummary(state.months[key]!));

    return HttpResponse.json(paginate(rows, url));
  }),

  /**
   * The exceptions of one month. Registered before `/months/:monthKey` so the
   * literal segment wins — first match wins, and the parameterized route would
   * otherwise answer this with a month summary.
   */
  http.get('*/admin/months/:monthKey/exceptions', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const resolved = url.searchParams.get('resolved');
    let rows = state.monthExceptions.filter((e) => e.monthKey === params.monthKey);
    if (resolved === 'true') rows = rows.filter((e) => e.resolvedAt !== null);
    if (resolved === 'false') rows = rows.filter((e) => e.resolvedAt === null);

    // Unresolved first, then oldest first inside each group: this is a work queue,
    // and the accountant is working it front to back before a publish.
    rows = sortRows(rows, url, (a, b) => {
      if ((a.resolvedAt === null) !== (b.resolvedAt === null)) return a.resolvedAt === null ? -1 : 1;
      return a.raisedAt.localeCompare(b.raisedAt);
    });

    return HttpResponse.json(paginate(rows, url));
  }),

  http.get('*/admin/months/:monthKey', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose');
    if ('response' in auth) return auth.response;

    const record = monthRecord(String(params.monthKey));
    if (!record) return noSuchMonth(String(params.monthKey));
    return HttpResponse.json(monthSummary(record));
  }),

  /**
   * Enter or correct the auction rate.
   *
   * `PUT`, not `POST`: entering the rate twice before publishing is a correction,
   * not a second rate, and the office does correct a mistyped figure. Once the
   * month is published it is immutable (BR-108) and this answers `409`.
   */
  http.put('*/admin/months/:monthKey/rate', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose', 'write');
    if ('response' in auth) return auth.response;

    const monthKey = String(params.monthKey);
    const record = monthRecord(monthKey);
    if (!record) return noSuchMonth(monthKey);
    if (record.stage === 'published') {
      return fail({
        status: 409,
        code: 'month-locked',
        message: `${monthKey} is published and its rate can no longer be changed.`,
        details: { monthKey },
      });
    }

    const body = (await request.json()) as MonthlyRateEntry;
    if (
      typeof body.ratePerKg !== 'number' ||
      body.ratePerKg <= 0 ||
      typeof body.extraRatePerKg !== 'number' ||
      body.extraRatePerKg < 0
    ) {
      return fail({
        status: 422,
        code: 'invalid-rate',
        message: 'A rate must be a positive amount, and the extra cannot be negative.',
      });
    }

    const before = record.rate;
    record.rate = {
      monthKey,
      ratePerKg: body.ratePerKg,
      extraRatePerKg: body.extraRatePerKg,
      enteredById: auth.user.id,
      enteredByName: auth.user.name,
      enteredAt: new Date().toISOString(),
    };
    // Entering the rate is what moves the month on from `awaitingRate` — the stage
    // is derived from what has happened, never set by the client.
    if (record.stage === 'collecting' || record.stage === 'awaitingRate') {
      record.stage = 'rateEntered';
    }

    recordBy(auth, 'month.rate.enter', 'monthlyRate', monthKey, {
      before: before ? { ratePerKg: before.ratePerKg, extraRatePerKg: before.extraRatePerKg } : { ratePerKg: null },
      after: { ratePerKg: record.rate.ratePerKg, extraRatePerKg: record.rate.extraRatePerKg },
    });

    return HttpResponse.json(monthSummary(record));
  }),

  http.post('*/admin/months/:monthKey/exceptions/:id/resolve', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose', 'write');
    if ('response' in auth) return auth.response;

    const { note } = (await request.json()) as { note?: string };
    const index = state.monthExceptions.findIndex(
      (e) => e.id === params.id && e.monthKey === params.monthKey,
    );
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such exception.' });

    const before = state.monthExceptions[index]!;
    if (lockedMonth(before.monthKey)) {
      return fail({
        status: 409,
        code: 'month-locked',
        message: `${before.monthKey} is already published.`,
      });
    }
    if (before.resolvedAt !== null) {
      return fail({
        status: 409,
        code: 'already-resolved',
        message: 'Someone else has already resolved this.',
      });
    }
    // The note is the whole point: a month closed with eleven exceptions marked
    // resolved and no reasons is a month nobody can defend six months later.
    if (!note || note.trim().length < 10) {
      return fail({ status: 422, code: 'note-required', message: 'A note is required.' });
    }

    const after: MonthException = {
      ...before,
      resolvedAt: new Date().toISOString(),
      resolvedByName: auth.user.name,
      resolutionNote: note.trim(),
    };
    state.monthExceptions[index] = after;

    recordBy(auth, 'month.exception.resolve', 'monthException', after.id, {
      before: { resolvedAt: null },
      after: { type: after.type, note: after.resolutionNote },
    });

    return HttpResponse.json(after);
  }),

  /**
   * Publish the month. **Irreversible**, and the four refusals are the point.
   *
   * `approve`, not `write`: §12.1 gives `ratesAndMonthClose: A` to the manager and
   * `W` to the accountant, so the person who enters the rate is not the person who
   * closes the month on it.
   */
  http.post('*/admin/months/:monthKey/publish', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose', 'approve');
    if ('response' in auth) return auth.response;

    const monthKey = String(params.monthKey);
    const body = (await request.json().catch(() => ({}))) as { monthKey?: string; note?: string };

    // The screen can be left open on July while somebody else publishes June, so
    // the month the accountant is looking at has to match the one in the path.
    if (body.monthKey && body.monthKey !== monthKey) {
      return fail({
        status: 409,
        code: 'month-mismatch',
        message: 'The screen is showing a different month. Reload and check before publishing.',
        details: { expected: monthKey, received: body.monthKey },
      });
    }

    const record = monthRecord(monthKey);
    if (!record) return noSuchMonth(monthKey);
    if (record.stage === 'published') {
      return fail({
        status: 409,
        code: 'already-published',
        message: `${monthKey} was already published.`,
        details: { publishedAt: record.publishedAt, publishedByName: record.publishedByName },
      });
    }
    if (!record.rate) {
      return fail({
        status: 409,
        code: 'rate-missing',
        message: 'The auction rate has not been entered for this month.',
      });
    }

    const open = state.monthExceptions.filter(
      (e) => e.monthKey === monthKey && e.resolvedAt === null,
    );
    // AC-04: the accountant resolves each one. A count that could be clicked past
    // is not a control.
    if (open.length > 0) {
      return fail({
        status: 409,
        code: 'exceptions-open',
        message: `${open.length} exceptions are still open.`,
        details: { open: open.length },
      });
    }

    // BR-501, the four-eyes rule. Reachable because a manager holds `approve`,
    // which implies `write` — so the same person *could* enter a rate and close the
    // month on it, and this is what stops them.
    if (isSelfApproval(auth.user, record.rate.enteredById)) {
      return fail({
        status: 409,
        code: 'four-eyes-violation',
        message: 'You entered this month’s rate, so you cannot publish it.',
        details: { enteredByName: record.rate.enteredByName },
      });
    }

    record.stage = 'published';
    record.publishedAt = new Date().toISOString();
    record.publishedByName = auth.user.name;
    record.publishedById = auth.user.id;

    recordBy(auth, 'month.publish', 'monthlyRate', monthKey, {
      before: { stage: 'billsGenerated' },
      after: {
        stage: 'published',
        ratePerKg: record.rate.ratePerKg,
        extraRatePerKg: record.rate.extraRatePerKg,
        note: body.note ?? null,
      },
    });

    return HttpResponse.json(monthSummary(record));
  }),

  /* ── M9 Change requests ────────────────────────────────────────────────── */
  http.get('*/admin/change-requests', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'changeRequests');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const supplierId = url.searchParams.get('supplierId');
    const q = url.searchParams.get('q')?.trim().toLowerCase();

    let rows = state.changeRequests.map(withAge);
    if (status) rows = rows.filter((r) => r.status === status);
    if (type) rows = rows.filter((r) => r.type === type);
    if (supplierId) rows = rows.filter((r) => r.supplierId === supplierId);
    if (q) {
      rows = rows.filter(
        (r) =>
          r.supplierCode.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q),
      );
    }

    // Oldest first within an inbox: a queue is worked front to back, and the
    // item that has waited longest is the one at risk of breaching §14.4. A clerk
    // may sort by another column, but that is a choice they make — never the
    // order they are given.
    rows = sortRows(rows, url, (a, b) => a.createdAt.localeCompare(b.createdAt));

    return HttpResponse.json(paginate(rows, url));
  }),

  http.get('*/admin/change-requests/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'changeRequests');
    if ('response' in auth) return auth.response;

    const found = state.changeRequests.find((r) => r.id === params.id);
    if (!found) return fail({ status: 404, code: '404', message: 'No such request.' });
    return HttpResponse.json(withAge(found));
  }),

  ...(['approve', 'reject'] as const).map((verb) =>
    http.post(`*/admin/change-requests/:id/${verb}`, async ({ request, params }) => {
      await delay(LATENCY_MS);
      const auth = authorize(request, 'changeRequests', 'approve');
      if ('response' in auth) return auth.response;

      const index = state.changeRequests.findIndex((r) => r.id === params.id);
      if (index < 0) return fail({ status: 404, code: '404', message: 'No such request.' });

      const before = state.changeRequests[index]!;
      const { note } = (await request.json()) as { note?: string };

      // AC-06. Both verbs, not only reject: an approval with no note is a
      // decision nobody can reconstruct.
      if (!note || note.trim().length < 10) {
        return fail({
          status: 422,
          code: 'note-required',
          message: 'A decision note is required.',
        });
      }

      // Two clerks, one inbox. Refused rather than silently overwritten,
      // because the second decision would replace the first in the audit log.
      if (before.status !== 'pending') {
        return fail({
          status: 409,
          code: 'already-decided',
          message: `This request was already ${before.status}.`,
          details: { decidedByName: before.decision?.decidedByName ?? null },
        });
      }

      // BR-501. A refusal, not a warning.
      if (isSelfApproval(auth.user, before.createdById)) {
        return fail({
          status: 409,
          code: 'four-eyes-violation',
          message: 'You raised this request, so you cannot decide it.',
          details: { createdByName: before.createdByName },
        });
      }

      const status = verb === 'approve' ? 'approved' : 'rejected';
      const after: AdminChangeRequest = {
        ...before,
        status,
        decision: {
          note: note.trim(),
          decidedById: auth.user.id,
          decidedByName: auth.user.name,
          decidedAt: new Date().toISOString(),
        },
      };
      state.changeRequests[index] = after;

      /**
       * AC-02: approving changes the supplier's active value; rejecting leaves it
       * untouched. This is the whole point of the module, and getting it backwards
       * would be invisible in the console and very visible in the app.
       */
      if (status === 'approved') {
        const supplierIndex = state.suppliers.findIndex((s) => s.id === before.supplierId);
        if (supplierIndex >= 0) {
          const supplier = state.suppliers[supplierIndex]!;
          state.suppliers[supplierIndex] = {
            ...supplier,
            paymentMethod: before.requestedPaymentMethod ?? supplier.paymentMethod,
            bankDetails: before.requestedBankDetails ?? supplier.bankDetails,
            hasBankDetails: Boolean(before.requestedBankDetails) || supplier.hasBankDetails,
            savingsPerKg: before.requestedSavingsPerKg ?? supplier.savingsPerKg,
            pendingRequests: Math.max(0, supplier.pendingRequests - 1),
          };
        }
      } else {
        const supplierIndex = state.suppliers.findIndex((s) => s.id === before.supplierId);
        if (supplierIndex >= 0) {
          const supplier = state.suppliers[supplierIndex]!;
          state.suppliers[supplierIndex] = {
            ...supplier,
            pendingRequests: Math.max(0, supplier.pendingRequests - 1),
          };
        }
      }

      // AC-09: within one second, with actor and before/after.
      record({
        actorId: auth.user.id,
        actorName: auth.user.name,
        action: `changeRequest.${verb}`,
        entity: 'changeRequest',
        entityId: before.id,
        before: { status: before.status },
        after: { status, note: note.trim() },
      });

      return HttpResponse.json(after);
    }),
  ),

  /* ── M17 Audit ─────────────────────────────────────────────────────────── */
  http.get('*/admin/audit', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'auditLog');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const entity = url.searchParams.get('entity');
    const entityId = url.searchParams.get('entityId');
    const actorId = url.searchParams.get('actorId');

    let rows = state.audit;
    if (entity) rows = rows.filter((e) => e.entity === entity);
    if (entityId) rows = rows.filter((e) => e.entityId === entityId);
    if (actorId) rows = rows.filter((e) => e.actorId === actorId);

    // Newest first: a log is read from the top, and the entry someone is looking
    // for is almost always the one that just happened.
    rows = sortRows(rows, url, (a, b) => b.at.localeCompare(a.at));

    return HttpResponse.json(paginate(rows, url));
  }),

  /* ── Attachments ───────────────────────────────────────────────────────── */
  http.post('*/admin/uploads/sign', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'changeRequests', 'write');
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as {
      filename: string;
      contentType: string;
      sizeBytes: number;
    };
    const id = `att-${nextId()}`;

    return HttpResponse.json({
      uploadUrl: `https://mock-storage.invalid/uploads/${id}`,
      headers: { 'Content-Type': body.contentType },
      attachment: {
        id,
        filename: body.filename,
        contentType: body.contentType,
        sizeBytes: body.sizeBytes,
        url: `https://mock-storage.invalid/uploads/${id}`,
        uploadedAt: new Date().toISOString(),
        uploadedByName: auth.user.name,
      },
    });
  }),

  /** The presigned PUT itself, so an upload completes end to end in the mock. */
  http.put('https://mock-storage.invalid/uploads/*', async () => {
    await delay(LATENCY_MS * 2);
    return new HttpResponse(null, { status: 200 });
  }),
];

/**
 * Reset between tests. Not used by the browser worker — a page reload does this
 * for free — but essential in Vitest, where module state persists across cases.
 */
export function resetMockState(): void {
  state.suppliers = mockSuppliers.map((s) => ({ ...s }));
  state.changeRequests = mockChangeRequests.map((r) => ({ ...r }));
  /**
   * The delivery rows and the idempotency store reset with everything else.
   *
   * Not optional, and the failure it prevents is a subtle one: `sequence` restarts
   * at 1000, so a row left over from an earlier test carries an id the *next* test
   * will hand out again. Two rows then share `del-1002`, and an assertion about
   * one of them silently reads the other.
   */
  state.deliveries = mockDeliveries.map((d) => ({ ...d }));
  state.batches.clear();
  // A published month leaking into the next test would lock M3 for it.
  state.months = cloneMonths();
  state.monthExceptions = mockMonthExceptions.map((e) => ({ ...e }));
  state.audit = [...mockAudit];
  state.sessions.clear();
  state.challenges.clear();
  state.sequence = 1000;
  // The stand-in cookie too, or a signed-in session leaks into the next test and
  // an RBAC assertion passes as the wrong user.
  writeRefreshCookie(null);
}
