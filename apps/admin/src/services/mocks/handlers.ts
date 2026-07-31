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
  Paged,
  SupplierListItem,
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
  isMonthLocked,
  mockAudit,
  mockChangeRequests,
  mockConfigs,
  mockDeliveries,
  mockFullAccountNumbers,
  mockSuppliers,
  mockUsers,
  summariseDay,
  toListItem,
  type MockUser,
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
  sequence: 1000,
};

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
    const sort = url.searchParams.get('sort') ?? 'supplierCode';
    const dir = url.searchParams.get('dir') === 'desc' ? -1 : 1;

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

    rows.sort((a, b) => {
      const left = a[sort as keyof SupplierListItem];
      const right = b[sort as keyof SupplierListItem];
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * dir;
      return String(left ?? '').localeCompare(String(right ?? '')) * dir;
    });

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
    // item that has waited longest is the one at risk of breaching §14.4.
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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
  state.audit = [...mockAudit];
  state.sessions.clear();
  state.challenges.clear();
  state.sequence = 1000;
  // The stand-in cookie too, or a signed-in session leaks into the next test and
  // an RBAC assertion passes as the wrong user.
  writeRefreshCookie(null);
}
