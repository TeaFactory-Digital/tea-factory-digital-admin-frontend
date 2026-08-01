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
  AdminBill,
  AdminNewsArticle,
  AdminStaticPage,
  AdminChangeRequest,
  AdminCreditRequest,
  AdminInquiry,
  AdminSavingsLedgerEntry,
  AdminSupplier,
  AuditEntry,
  BillListItem,
  BillRun,
  Capability,
  ContentPreview,
  ContentTranslation,
  ContentTranslations,
  ConsoleUser,
  CreditFacility,
  Delivery,
  DeliveryBatch,
  DeliveryBatchResult,
  DeliveryRejection,
  FeatureFlagName,
  MonthCycleStage,
  MonthException,
  MonthSummary,
  LanguageCode,
  MonthlyRateEntry,
  NewsListItem,
  Paged,
  PaymentMethod,
  PayoutLine,
  PayoutRun,
  SavingsAccount,
  SavingsSummary,
  StaticPageSlug,
} from '@tfd/domain';
import {
  CREDIT_FACILITY_FLAGS,
  EDITORIAL_FALLBACK_LANGUAGE,
  MAX_CONTENT_BODY_CHARS,
  MAX_CONTENT_TITLE_CHARS,
  MAX_DELIVERY_BATCH_ROWS,
  MAX_DELIVERY_KG,
  STATIC_PAGE_SLUGS,
  can,
  deductionsBalance,
  isExactKg,
  isInquiryClosed,
  isSelfApproval,
  missingTranslations,
  monthKeyOf,
  publishability,
  resolveTranslation,
  slugify,
  staleTranslations,
  round2,
  roundKg,
  summariseKgs,
} from '@tfd/domain';
import {
  MOCK_MFA_CODE,
  MOCK_PASSWORD,
  TODAY,
  billFactoryOf,
  buildDashboard,
  buildPayoutLines,
  currentMonthKey,
  eligibilityFor,
  generateBills,
  mockAudit,
  mockBillRuns,
  mockBills,
  mockChangeRequests,
  mockConfigs,
  mockCreditRequests,
  mockDeliveries,
  mockInquiries,
  mockMonthExceptions,
  mockMonths,
  mockNews,
  mockPayoutLines,
  mockPayoutRuns,
  mockSavingsLedger,
  monthStageOf,
  mockFullAccountNumbers,
  mockStaticPages,
  mockSuppliers,
  mockUsers,
  summariseBillRun,
  summariseDay,
  summarisePayoutRun,
  toListItem,
  type BillRunRecord,
  type MockUser,
  type MonthRecord,
  type NewsRecord,
  type StaticPageRecord,
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
  /**
   * M5's bills, and the run each came out of.
   *
   * Held as generated output rather than recomputed per request, which is the one
   * place a read model has to be *stored*: a bill is what the supplier was handed,
   * so it must not silently change when a delivery is voided the following week.
   * The way to pick a change up is to re-generate, and only while the month is open.
   */
  bills: mockBills.map((bill) => ({ ...bill })),
  billRuns: mockBillRuns.map((run) => ({ ...run })),
  payoutRuns: mockPayoutRuns.map((run) => ({ ...run })),
  payoutLines: mockPayoutLines.map((line) => ({ ...line })),
  savingsLedger: mockSavingsLedger.map((entry) => ({ ...entry })),
  /**
   * M7's queue. The stored `eligibility` on each row is the fixture's snapshot and
   * is **replaced on every read** — see `withCreditEligibility`. It is kept on the
   * record only so a decided request retains the figures it was decided against.
   */
  creditRequests: mockCreditRequests.map((request) => ({ ...request })),
  inquiries: mockInquiries.map((inquiry) => ({ ...inquiry })),
  /**
   * Content records, **deep-copied down to the translations map**.
   *
   * `{ ...record }` would share the `translations` object with the seed, so saving one
   * language would mutate the fixture and `resetMockState()` would hand the mutated
   * object back. That is the same trap `cloneMonths()` documents, and it bites harder
   * here: the symptom is a test suite where the second case finds Sinhala already
   * written and the AC-08 gap it was asserting on has quietly disappeared.
   */
  news: mockNews.map(cloneNews),
  staticPages: mockStaticPages.map(cloneStaticPage),
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

/** Deep enough to isolate the translations map — see the `state.news` comment. */
function cloneNews(record: NewsRecord): NewsRecord {
  return { ...record, translations: { ...record.translations } };
}

function cloneStaticPage(record: StaticPageRecord): StaticPageRecord {
  return { ...record, translations: { ...record.translations } };
}

/* ─────────────────── M11 / M12 content helpers (AC-08) ─────────────────── */

/**
 * The languages **this tenant** authors in.
 *
 * Read per request rather than fixed, because it is what makes a gap a gap: `highland`
 * authors in English and Tamil, so it is not missing Sinhala — it never asked for it. A
 * server that reported gaps against the platform's three languages would tell that
 * factory it had unfinished work it does not have, and an office told to ignore a
 * warning stops reading warnings.
 */
function contentLanguagesOf(request: Request): LanguageCode[] {
  const config = mockConfigs[tenantOf(request)] ?? mockConfigs.galaboda!;
  return config.localization.contentLanguages;
}

/** The newest edit in any language — the record's own `updatedAt`. */
function newestEdit(translations: ContentTranslations): ContentTranslation | null {
  return Object.values(translations).reduce<ContentTranslation | null>(
    (newest, one) => (!newest || (one && one.updatedAt > newest.updatedAt) ? (one ?? newest) : newest),
    null,
  );
}

/**
 * Attach the gaps, derived against the requesting tenant's languages.
 *
 * Both lists come from `@tfd/domain/content.ts` rather than being recomputed here: the
 * console renders the same warnings from the same functions, so a disagreement between
 * what the API flags and what the editor sees is impossible by construction. That is the
 * only version of AC-08 worth having.
 */
function serialiseNews(record: NewsRecord, request: Request): AdminNewsArticle {
  const required = contentLanguagesOf(request);
  const newest = newestEdit(record.translations);

  return {
    ...record,
    missingLanguages: missingTranslations(record.translations, required),
    staleLanguages: staleTranslations(record.translations, required),
    updatedAt: newest?.updatedAt ?? record.createdAt,
    updatedByName: newest?.updatedByName ?? record.createdByName,
  };
}

function toNewsListItem(record: NewsRecord, request: Request): NewsListItem {
  const full = serialiseNews(record, request);
  const fallback = record.translations[EDITORIAL_FALLBACK_LANGUAGE];

  return {
    id: full.id,
    slug: full.slug,
    // The **fallback** title, always: a list whose titles changed with the selected tab
    // would be unreadable while translating.
    title: fallback?.title ?? '—',
    status: full.status,
    publishedAt: full.publishedAt,
    updatedAt: full.updatedAt,
    updatedByName: full.updatedByName,
    hasCoverImage: Boolean(record.coverImageUrl),
    missingLanguages: full.missingLanguages,
    staleLanguages: full.staleLanguages,
  };
}

function serialiseStaticPage(record: StaticPageRecord, request: Request): AdminStaticPage {
  const required = contentLanguagesOf(request);
  const newest = newestEdit(record.translations);

  return {
    ...record,
    missingLanguages: missingTranslations(record.translations, required),
    staleLanguages: staleTranslations(record.translations, required),
    updatedAt: newest?.updatedAt ?? null,
    updatedByName: newest?.updatedByName ?? null,
  };
}

/**
 * The preview: what a reader in `lang` actually gets.
 *
 * Resolved with the **shared** `resolveTranslation`, which is the same function the app
 * will call. An editor signing off copy the app never renders is the AC-08 failure with
 * the console's fingerprints on it, and this is what makes it structurally impossible.
 */
function contentPreview(translations: ContentTranslations, lang: LanguageCode): ContentPreview {
  const resolved = resolveTranslation(translations, lang);
  return {
    lang,
    translation: resolved?.translation ?? null,
    usedFallback: resolved?.usedFallback ?? false,
    fallbackLanguage: EDITORIAL_FALLBACK_LANGUAGE,
  };
}

/**
 * Refuse a publish with nothing to fall back to.
 *
 * The **only** hard requirement on content, and the AC-08 policy made operable: gaps are
 * publishable because the app falls back, and no fallback is not publishable because
 * there would be nothing to fall back *to*. Returning the gaps in `details` lets the
 * console name the languages rather than saying "incomplete".
 */
function requireFallbackCopy(translations: ContentTranslations, request: Request): Response | null {
  const required = contentLanguagesOf(request);
  const check = publishability(translations, required);
  if (check.ok) return null;

  return fail({
    status: 422,
    code: 'fallback-translation-missing',
    message: `There is no ${EDITORIAL_FALLBACK_LANGUAGE.toUpperCase()} copy, so nothing can be shown to a supplier.`,
    details: { fallbackLanguage: EDITORIAL_FALLBACK_LANGUAGE, missing: check.missing },
  });
}

/** A parsed, non-blank translation body, or the refusal to send. */
function readTranslationBody(
  body: { title?: string; excerpt?: string; body?: string },
): { title: string; excerpt?: string; body: string } | Response {
  const title = body.title?.trim() ?? '';
  const text = body.body?.trim() ?? '';

  // The server half of `isWritten`. A translation that exists and says nothing counts as
  // written everywhere it is read, so the gap AC-08 requires to be visible disappears —
  // and a supplier gets a blank article.
  if (title.length === 0 || text.length === 0) {
    return fail({
      status: 422,
      code: 'note-required',
      message: 'A translation needs a title and a body.',
      details: { title: title.length, body: text.length },
    });
  }
  if (title.length > MAX_CONTENT_TITLE_CHARS || text.length > MAX_CONTENT_BODY_CHARS) {
    return fail({ status: 422, code: 'invalid', message: 'That copy is longer than the limit.' });
  }

  const excerpt = body.excerpt?.trim();
  return { title, excerpt: excerpt || undefined, body: text };
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

/* ──────────────────────────── M5 Bills helpers ──────────────────────────── */

function billRunFor(monthKey: string): BillRunRecord | null {
  return state.billRuns.find((run) => run.monthKey === monthKey) ?? null;
}

/**
 * A run, with `stale` decided at read time against the live leaf.
 *
 * Never stored, because staleness is a *relationship* between the run and the
 * delivery rows, and a stored flag would go on lying the moment somebody voided a
 * weighing. A published month cannot be stale — nothing can change under it (BR-108).
 */
function serialiseBillRun(run: BillRunRecord): BillRun {
  const rows = state.deliveries.filter((row) => row.monthKey === run.monthKey && !row.voidedAt);
  const liveKgs = summariseKgs(rows.map((row) => ({ supplierId: row.supplierId, kgs: row.kgs })));
  const published = stageOf(run.monthKey) === 'published';

  return {
    ...run,
    stale: !published && Math.abs(liveKgs.totalKgs - run.totalKgs) > 0.005,
  };
}

function toBillListItem(bill: AdminBill): BillListItem {
  return {
    id: bill.id,
    supplierId: bill.supplierId,
    supplierCode: bill.supplierCode,
    supplierName: bill.supplierName,
    billNo: bill.billNo,
    monthKey: bill.monthKey,
    totalKgs: bill.totalKgs,
    grossAmount: bill.grossAmount,
    deductionsTotal: bill.deductions.total,
    finalBalance: bill.finalBalance,
    paymentMethod: bill.paymentMethod,
    carriesDebt: bill.carryForward.nextMonthDeb > 0,
    hasBankDetails: bill.hasBankDetails,
    // BR-107, checked rather than assumed. See the generate handler.
    unbalanced: !deductionsBalance(bill.deductions),
  };
}

/**
 * What the previous accounts leave for this one.
 *
 * The chain is the reason a bill cannot be computed in isolation: coins held back
 * last month are spendable this month, an unpaid balance becomes `previousDebts`,
 * and the savings figure printed as "previous" is the ledger's running balance. A
 * month generated without them would tie to nothing.
 */
function carriedInto(monthKey: string) {
  const coins = new Map<string, number>();
  const debts = new Map<string, number>();
  const savings = new Map<string, number>();

  for (const bill of [...state.bills]
    .filter((candidate) => candidate.monthKey < monthKey)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))) {
    coins.set(bill.supplierId, bill.coinsCarriedForward);
    debts.set(bill.supplierId, bill.carryForward.nextMonthDeb);
  }

  // The savings balance of record is the ledger's, not the registry's — see M8.
  for (const entry of state.savingsLedger) {
    if (entry.monthKey < monthKey) savings.set(entry.supplierId, entry.balance);
  }

  return { coins, debts, savings };
}

/** The running savings balance for one supplier, as the ledger has it. */
function savingsBalanceOf(supplierId: string): number {
  let balance = 0;
  for (const entry of state.savingsLedger) {
    if (entry.supplierId === supplierId) balance = entry.balance;
  }
  return balance;
}

/**
 * Post a published month's savings deductions to the ledger.
 *
 * Runs **on publish**, not on generation, because a contribution is a deduction
 * from a bill the supplier has actually been given. Crediting savings off a draft
 * bill would put money in a passbook against a figure the office might still
 * re-generate.
 */
function postSavingsFor(monthKey: string, publishedAt: string): number {
  const bills = state.bills
    .filter((bill) => bill.monthKey === monthKey && bill.deductions.savings > 0)
    .sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));

  for (const bill of bills) {
    // Idempotent: publishing is once-only, but a replayed request must not credit
    // a supplier twice — and this is money.
    if (state.savingsLedger.some((entry) => entry.billId === bill.id)) continue;

    const balance = round2(savingsBalanceOf(bill.supplierId) + bill.deductions.savings);
    state.savingsLedger.push({
      id: `sav-${nextId()}`,
      supplierId: bill.supplierId,
      monthKey,
      month: bill.month,
      amount: bill.deductions.savings,
      balance,
      source: 'billDeduction',
      billId: bill.id,
      recordedAt: publishedAt,
      note: null,
    });

    // The registry's balance follows the ledger, so M2's detail page and M8's
    // account row are one number rather than two (AC-01).
    const index = state.suppliers.findIndex((supplier) => supplier.id === bill.supplierId);
    if (index >= 0) state.suppliers[index] = { ...state.suppliers[index]!, savingsBalance: balance };
  }

  return bills.length;
}

/* ─────────────────────────── M6 Payouts helpers ─────────────────────────── */

const linesOf = (runId: string): PayoutLine[] =>
  state.payoutLines.filter((line) => line.runId === runId);

/** Counts and totals derived from the lines, never from stored figures. */
const serialisePayoutRun = (run: PayoutRun): PayoutRun =>
  summarisePayoutRun(run, linesOf(run.id));

/* ─────────────────────────── feature flags (AC-07) ─────────────────────────── */

/**
 * The **API half** of a feature flag.
 *
 * AC-07 is only half met by hiding a surface: "a flag off removes the surface *and*
 * the endpoint refuses". The console hides the sidebar row and guards the route; a
 * tenant that does not buy payouts must also be unable to reach the endpoint by
 * typing a URL or replaying a request.
 */
function featureGate(request: Request, flag: FeatureFlagName): Response | null {
  if (flagsOf(request)[flag]) return null;
  return fail({
    status: 403,
    code: 'feature-disabled',
    message: 'This factory does not use that feature.',
    details: { flag },
  });
}

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

/**
 * Authorize against **any one** of several capabilities.
 *
 * For a read two modules share. The money modules' month picker is the case: a month
 * key is needed by `billing` and by `payouts`, and widening either module's own
 * capability to cover the other would grant access to that module's writes as a side
 * effect. The `403` names all of them, so a refusal is diagnosable.
 */
function authorizeAny(
  request: Request,
  capabilities: Capability[],
  level: 'read' | 'write' | 'approve' = 'read',
): { user: MockUser } | { response: Response } {
  const user = bearer(request);
  if (!user) {
    return {
      response: fail({ status: 401, code: 'unauthenticated', message: 'Sign in required.' }),
    };
  }
  if (!capabilities.some((capability) => can(user.grants, capability, level))) {
    return {
      response: fail({
        status: 403,
        code: 'forbidden',
        message: `Your role cannot ${level} any of: ${capabilities.join(', ')}.`,
        details: { capabilities, required: level },
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

/** Hours since an ISO timestamp — what every queue's age column is derived from. */
const ageHoursOf = (createdAt: string): number =>
  (Date.now() - new Date(createdAt).getTime()) / 3_600_000;

/** Re-derives `ageHours` at read time, so a queue row's urgency is never stale. */
function withAge(request: AdminChangeRequest): AdminChangeRequest {
  return { ...request, ageHours: ageHoursOf(request.createdAt) };
}

/**
 * A credit row with its age **and its eligibility** re-derived.
 *
 * The eligibility half is the one that matters: a ceiling is a function of leaf
 * and rates, and both move under a queue that is left open. Recomputing on read is
 * what makes `stale-eligibility` a refusal the console can actually meet, because
 * the figures on the row and the figures the approval re-checks come from the same
 * function seconds apart rather than from a write months old.
 *
 * A **decided** request keeps its stored figures: those are what the decision was
 * made against, and recomputing them would rewrite history every time the page is
 * opened.
 */
function withCreditEligibility(request: AdminCreditRequest): AdminCreditRequest {
  const base = { ...request, ageHours: ageHoursOf(request.createdAt) };
  if (request.status !== 'pending') return base;

  const supplier = state.suppliers.find((s) => s.id === request.supplierId);
  if (!supplier) return base;
  // The **live** delivery rows: an advance ceiling is priced off this month's leaf,
  // so a session committed a minute ago has to be in the figure.
  return {
    ...base,
    eligibility: eligibilityFor(supplier, request.facility, { deliveries: state.deliveries }),
  };
}

function withInquiryAge(inquiry: AdminInquiry): AdminInquiry {
  return { ...inquiry, ageHours: ageHoursOf(inquiry.createdAt) };
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

    const summary = buildDashboard(
      state.changeRequests,
      state.deliveries,
      state.creditRequests,
      state.inquiries,
    );
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

  /**
   * The generation run for a month, or `404`.
   *
   * Registered before `/months/:monthKey` so the literal segment wins. A month with
   * no run is a `404` rather than an empty run, because "bills have not been built"
   * and "bills were built and came to nothing" are different answers and the close
   * checklist branches on which.
   */
  http.get('*/admin/months/:monthKey/bill-run', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'billing');
    if ('response' in auth) return auth.response;

    const monthKey = String(params.monthKey);
    if (!monthRecord(monthKey)) return noSuchMonth(monthKey);

    const run = billRunFor(monthKey);
    if (!run) {
      return fail({
        status: 404,
        code: 'bills-missing',
        message: `Bills have not been generated for ${monthKey}.`,
        details: { monthKey },
      });
    }
    return HttpResponse.json(serialiseBillRun(run));
  }),

  /**
   * Generate — or **re-generate** — a month's bills.
   *
   * A bill is a read model over the leaf and the rate (api.md §16), so this is a
   * recomputation, not a write of a new fact. That is exactly why re-running before
   * the publish is the normal case rather than an exception: a delivery gets voided,
   * a change request is approved, and the figures move. After the publish the month
   * is immutable and this answers `month-locked` (BR-108).
   */
  http.post('*/admin/months/:monthKey/bills/generate', async ({ request, params }) => {
    await delay(LATENCY_MS * 2);
    const auth = authorize(request, 'billing', 'write');
    if ('response' in auth) return auth.response;

    const monthKey = String(params.monthKey);
    const body = (await request.json().catch(() => ({}))) as { monthKey?: string };
    if (body.monthKey && body.monthKey !== monthKey) {
      return fail({
        status: 409,
        code: 'month-mismatch',
        message: 'The screen is showing a different month. Reload and check.',
        details: { expected: monthKey, received: body.monthKey },
      });
    }

    const record = monthRecord(monthKey);
    if (!record) return noSuchMonth(monthKey);
    if (record.stage === 'published') {
      return fail({
        status: 409,
        code: 'month-locked',
        message: `${monthKey} is published — its bills are the record now.`,
        details: { monthKey },
      });
    }
    // Nothing to build a bill from. Refused rather than producing a page of bills
    // with every amount blank, which reads as a broken run instead of a missing rate.
    if (!record.rate) {
      return fail({
        status: 409,
        code: 'rate-missing',
        message: 'The auction rate has not been entered for this month.',
      });
    }

    const runId = `run-${monthKey}-${nextId()}`;
    const generatedAt = new Date().toISOString();
    const carried = carriedInto(monthKey);

    const bills = generateBills({
      monthKey,
      runId,
      generatedAt,
      generatedById: auth.user.id,
      generatedByName: auth.user.name,
      publishedAt: null,
      deliveries: state.deliveries,
      suppliers: state.suppliers,
      rate: record.rate,
      factory: billFactoryOf(tenantOf(request)),
      coinsBroughtForward: carried.coins,
      debtBroughtForward: carried.debts,
      savingsBefore: carried.savings,
    });

    /**
     * BR-107, as a refusal rather than a warning.
     *
     * The arithmetic in `@tfd/domain` derives `total` from the nine lines, so this
     * cannot fire against that implementation — and it is here for the one that
     * matters: a backend that computes the total separately and lets it drift is a
     * backend that prints a slip whose column does not add up. Better a run that
     * refuses than a supplier holding the evidence.
     */
    const unbalanced = bills.filter((bill) => !deductionsBalance(bill.deductions));
    if (unbalanced.length > 0) {
      return fail({
        status: 422,
        code: 'bills-unbalanced',
        message: `${unbalanced.length} bills have deduction lines that do not add up to their total.`,
        details: { billNos: unbalanced.slice(0, 5).map((bill) => bill.billNo) },
      });
    }

    // A re-run replaces the previous one rather than accumulating beside it: two
    // runs for one open month is two sets of figures nobody can choose between.
    state.bills = [...state.bills.filter((bill) => bill.monthKey !== monthKey), ...bills];
    const summary = summariseBillRun(monthKey, runId, bills, {
      generatedAt,
      generatedById: auth.user.id,
      generatedByName: auth.user.name,
    });
    state.billRuns = [...state.billRuns.filter((run) => run.monthKey !== monthKey), summary];

    // Generating is what occupies §13's `billsGenerated` stage. The stage is
    // derived from what has happened, never set by the client.
    if (record.stage === 'rateEntered' || record.stage === 'awaitingRate') {
      record.stage = 'billsGenerated';
    }

    recordBy(auth, 'month.bills.generate', 'billRun', runId, {
      after: {
        monthKey,
        bills: summary.billCount,
        payableTotal: summary.payableTotal,
        missingBankDetails: summary.missingBankDetails,
      },
    });

    return HttpResponse.json(serialiseBillRun(summary));
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

    /**
     * The bills have to exist, and they have to match the leaf.
     *
     * Publishing is what turns a generated bill into the document the supplier
     * holds, so a month published with no run has nothing to hand over — and one
     * published on a **stale** run hands over figures that disagree with the leaf
     * the month closed on. Both are refused rather than repaired here, because
     * re-generating inside a publish would mean the manager signs off figures they
     * never saw.
     *
     * Checked **after** the exceptions, which is where it belongs in the office's
     * order rather than merely in this function's: resolving an exception is what
     * changes a bill — collecting a bank details form, deciding a change request —
     * so bills generated before the queue is clear are bills that need generating
     * again. The refusals report the earliest unmet precondition, so the accountant
     * is sent to the first thing to do rather than the last.
     */
    const run = billRunFor(monthKey);
    if (!run) {
      return fail({
        status: 409,
        code: 'bills-missing',
        message: 'Bills have not been generated for this month.',
        details: { monthKey },
      });
    }
    if (serialiseBillRun(run).stale) {
      return fail({
        status: 409,
        code: 'bills-stale',
        message: 'The leaf has changed since the bills were generated. Re-generate them first.',
        details: { generatedAt: run.generatedAt, runKgs: run.totalKgs },
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

    const publishedAt = new Date().toISOString();
    record.stage = 'published';
    record.publishedAt = publishedAt;
    record.publishedByName = auth.user.name;
    record.publishedById = auth.user.id;

    /**
     * Publishing is the moment the bills become the supplier's, and the moment the
     * savings deducted on them are theirs.
     *
     * Both happen here rather than in M5 and M8 on their own, because there is
     * exactly one event: a month that published its bills but not its savings
     * contributions would show a supplier a deduction with no matching passbook
     * entry, which is the first thing they would query.
     */
    for (let index = 0; index < state.bills.length; index += 1) {
      const bill = state.bills[index]!;
      if (bill.monthKey === monthKey) state.bills[index] = { ...bill, publishedAt };
    }
    const credited = postSavingsFor(monthKey, publishedAt);

    recordBy(auth, 'month.publish', 'monthlyRate', monthKey, {
      before: { stage: 'billsGenerated' },
      after: {
        stage: 'published',
        ratePerKg: record.rate.ratePerKg,
        extraRatePerKg: record.rate.extraRatePerKg,
        bills: run.billCount,
        savingsCredited: credited,
        note: body.note ?? null,
      },
    });

    return HttpResponse.json(monthSummary(record));
  }),

  /* ── M5 Bills ──────────────────────────────────────────────────────────── */

  /**
   * The months the money screens can be pointed at. Registered before
   * the bills list — a distinct path, but the specific-first rule in this file has
   * already caught two bugs.
   *
   * Newest first, because the office works the month it just closed.
   */
  http.get('*/admin/bill-months', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorizeAny(request, ['billing', 'payouts']);
    if ('response' in auth) return auth.response;

    const rows = Object.keys(state.months)
      .sort()
      .reverse()
      .map((monthKey) => ({
        monthKey,
        stage: stageOf(monthKey),
        billCount: state.bills.filter((bill) => bill.monthKey === monthKey).length,
        open: stageOf(monthKey) !== 'published',
      }));

    return HttpResponse.json(rows);
  }),

  http.get('*/admin/bills', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'billing');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const monthKey = url.searchParams.get('monthKey');
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const missingBankDetails = url.searchParams.get('missingBankDetails');
    const carriesDebt = url.searchParams.get('carriesDebt');

    let rows = state.bills.map(toBillListItem);
    if (monthKey) rows = rows.filter((row) => row.monthKey === monthKey);
    if (q) {
      rows = rows.filter(
        (row) =>
          row.supplierCode.toLowerCase().includes(q) ||
          row.supplierName.toLowerCase().includes(q) ||
          row.billNo.toLowerCase().includes(q),
      );
    }
    // A payout run cannot pay these, so the office needs them as a list rather than
    // as a count on the run summary they are about to sign off.
    if (missingBankDetails === 'true') {
      rows = rows.filter((row) => !row.hasBankDetails && (row.finalBalance ?? 0) > 0);
    }
    if (carriesDebt === 'true') rows = rows.filter((row) => row.carriesDebt);

    // By supplier code, which is the order the paper ledgers were kept in and the
    // order the office checks a run down.
    rows = sortRows(rows, url, (a, b) => a.supplierCode.localeCompare(b.supplierCode));

    return HttpResponse.json(paginate(rows, url));
  }),

  http.get('*/admin/bills/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'billing');
    if ('response' in auth) return auth.response;

    const bill = state.bills.find((candidate) => candidate.id === params.id);
    if (!bill) return fail({ status: 404, code: '404', message: 'No such bill.' });
    return HttpResponse.json(bill);
  }),

  /* ── M6 Payouts ────────────────────────────────────────────────────────── */

  http.get('*/admin/payout-runs', async ({ request }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enablePayouts');
    if (gated) return gated;
    const auth = authorize(request, 'payouts');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const monthKey = url.searchParams.get('monthKey');
    const status = url.searchParams.get('status');

    let rows = state.payoutRuns.map(serialisePayoutRun);
    if (monthKey) rows = rows.filter((run) => run.monthKey === monthKey);
    if (status) rows = rows.filter((run) => run.status === status);

    // Newest month first, then by method, because the office works the run it just
    // prepared and the older ones are reference.
    rows = sortRows(rows, url, (a, b) =>
      b.monthKey.localeCompare(a.monthKey) || a.method.localeCompare(b.method),
    );

    return HttpResponse.json(paginate(rows, url));
  }),

  /**
   * Prepare a run: one month, one method.
   *
   * `month-not-published` is the load-bearing refusal and the reason this endpoint
   * cannot simply take a month key. A run against an open month pays against figures
   * that can still change — a rate correction, a voided delivery, an approved change
   * request — and money that has already left the factory cannot be re-derived.
   */
  http.post('*/admin/payout-runs', async ({ request }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enablePayouts');
    if (gated) return gated;
    const auth = authorize(request, 'payouts', 'write');
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as { monthKey?: string; method?: PaymentMethod };
    const monthKey = String(body.monthKey ?? '');
    const method = body.method;
    if (!monthKey || !method) {
      return fail({ status: 422, code: 'invalid', message: 'A month and a method are required.' });
    }

    const record = monthRecord(monthKey);
    if (!record) return noSuchMonth(monthKey);
    if (record.stage !== 'published') {
      return fail({
        status: 409,
        code: 'month-not-published',
        message: `${monthKey} is not published, so its figures can still change.`,
        details: { monthKey, stage: record.stage },
      });
    }

    const monthBills = state.bills.filter((bill) => bill.monthKey === monthKey);
    if (monthBills.length === 0) {
      return fail({
        status: 409,
        code: 'bills-missing',
        message: 'This month has no bills to pay against.',
        details: { monthKey },
      });
    }

    // One run per month per method. A second would be a second total for the same
    // payment, and the office would have no way to tell which one the bank saw.
    if (state.payoutRuns.some((run) => run.monthKey === monthKey && run.method === method)) {
      return fail({
        status: 409,
        code: 'run-exists',
        message: 'A run for this month and method already exists.',
        details: { monthKey, method },
      });
    }

    const id = `pay-${monthKey}-${method}`;
    const lines = buildPayoutLines(id, method, monthBills, state.suppliers, nextId);
    if (lines.length === 0) {
      return fail({
        status: 409,
        code: 'no-payable-lines',
        message: 'No supplier on this method has anything payable for this month.',
        details: { monthKey, method },
      });
    }

    const run = summarisePayoutRun(
      {
        id,
        monthKey,
        method,
        status: 'draft',
        lineCount: 0,
        payableCount: 0,
        heldCount: 0,
        paidCount: 0,
        failedCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        createdAt: new Date().toISOString(),
        createdById: auth.user.id,
        createdByName: auth.user.name,
        approvedAt: null,
        approvedById: null,
        approvedByName: null,
        completedAt: null,
      },
      lines,
    );

    state.payoutLines = [...state.payoutLines, ...lines];
    state.payoutRuns = [...state.payoutRuns, run];

    recordBy(auth, 'payout.run.create', 'payoutRun', id, {
      after: {
        monthKey,
        method,
        lines: run.lineCount,
        held: run.heldCount,
        totalAmount: run.totalAmount,
      },
    });

    return HttpResponse.json(serialisePayoutRun(run));
  }),

  /**
   * The lines of a run. Registered before `/payout-runs/:id` so the literal
   * segment wins.
   */
  http.get('*/admin/payout-runs/:id/lines', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enablePayouts');
    if (gated) return gated;
    const auth = authorize(request, 'payouts');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.trim().toLowerCase();

    let rows = linesOf(String(params.id));
    if (status) rows = rows.filter((line) => line.status === status);
    if (q) {
      rows = rows.filter(
        (line) =>
          line.supplierCode.toLowerCase().includes(q) ||
          line.supplierName.toLowerCase().includes(q),
      );
    }

    /**
     * Held first, then pending, then the settled ones.
     *
     * A run is worked by clearing what is stuck: a held line needs a passbook
     * collected before anything can move, and burying it under fifty paid rows is
     * how a supplier goes a month without being paid.
     */
    const rank = { held: 0, failed: 1, pending: 2, paid: 3 } as const;
    rows = sortRows(
      rows,
      url,
      (a, b) => rank[a.status] - rank[b.status] || a.supplierCode.localeCompare(b.supplierCode),
    );

    return HttpResponse.json(paginate(rows, url));
  }),

  http.get('*/admin/payout-runs/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enablePayouts');
    if (gated) return gated;
    const auth = authorize(request, 'payouts');
    if ('response' in auth) return auth.response;

    const run = state.payoutRuns.find((candidate) => candidate.id === params.id);
    if (!run) return fail({ status: 404, code: '404', message: 'No such payout run.' });
    return HttpResponse.json(serialisePayoutRun(run));
  }),

  /**
   * Approve a run — `payouts: approve`, which §12.1 gives the manager and not the
   * accountant who prepared it.
   *
   * Four eyes on money (BR-501): the same person may not prepare a run and release
   * it, and a manager holds `approve` which implies `write` — so they *could* do
   * both, and this is what stops them.
   */
  http.post('*/admin/payout-runs/:id/approve', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enablePayouts');
    if (gated) return gated;
    const auth = authorize(request, 'payouts', 'approve');
    if ('response' in auth) return auth.response;

    const index = state.payoutRuns.findIndex((candidate) => candidate.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such payout run.' });

    const before = state.payoutRuns[index]!;
    const { note } = (await request.json().catch(() => ({}))) as { note?: string };

    if (before.status !== 'draft') {
      return fail({
        status: 409,
        code: 'already-approved',
        message: 'This run has already been approved.',
        details: { approvedByName: before.approvedByName, approvedAt: before.approvedAt },
      });
    }
    if (isSelfApproval(auth.user, before.createdById)) {
      return fail({
        status: 409,
        code: 'four-eyes-violation',
        message: 'You prepared this run, so you cannot release it.',
        details: { createdByName: before.createdByName },
      });
    }
    const lines = linesOf(before.id);
    if (lines.every((line) => line.status === 'held')) {
      return fail({
        status: 409,
        code: 'no-payable-lines',
        message: 'Every line in this run is held. There is nothing to release.',
      });
    }

    const after: PayoutRun = {
      ...before,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedById: auth.user.id,
      approvedByName: auth.user.name,
    };
    state.payoutRuns[index] = after;

    recordBy(auth, 'payout.run.approve', 'payoutRun', after.id, {
      before: { status: 'draft' },
      after: {
        status: 'approved',
        totalAmount: summarisePayoutRun(after, lines).totalAmount,
        note: note ?? null,
      },
    });

    return HttpResponse.json(serialisePayoutRun(after));
  }),

  /**
   * Reconcile one line against what the bank or the counter actually did.
   *
   * Only after approval: marking a line paid in a draft run would record money
   * moving that nobody released. And a failure needs a reason, because the supplier
   * has not been paid and the next person to pick the run up works from that note.
   */
  http.post('*/admin/payout-runs/:id/lines/:lineId/mark', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enablePayouts');
    if (gated) return gated;
    const auth = authorize(request, 'payouts', 'write');
    if ('response' in auth) return auth.response;

    const runIndex = state.payoutRuns.findIndex((candidate) => candidate.id === params.id);
    if (runIndex < 0) return fail({ status: 404, code: '404', message: 'No such payout run.' });
    const run = state.payoutRuns[runIndex]!;

    if (run.status === 'draft') {
      return fail({
        status: 409,
        code: 'run-not-approved',
        message: 'This run has not been approved yet, so nothing in it has been paid.',
      });
    }

    const lineIndex = state.payoutLines.findIndex(
      (line) => line.id === params.lineId && line.runId === run.id,
    );
    if (lineIndex < 0) return fail({ status: 404, code: '404', message: 'No such payout line.' });

    const before = state.payoutLines[lineIndex]!;
    const body = (await request.json()) as { status?: 'paid' | 'failed'; reason?: string };

    if (before.status === 'held') {
      return fail({
        status: 409,
        code: 'line-not-payable',
        message: 'This line is held — there is no account to pay into.',
        details: { supplierCode: before.supplierCode },
      });
    }
    if (before.status === 'paid') {
      return fail({
        status: 409,
        code: 'line-not-payable',
        message: 'This line has already been paid.',
        details: { paidAt: before.paidAt, markedByName: before.markedByName },
      });
    }
    if (body.status !== 'paid' && body.status !== 'failed') {
      return fail({ status: 422, code: 'invalid', message: 'Mark a line paid or failed.' });
    }
    if (body.status === 'failed' && (body.reason?.trim().length ?? 0) < 10) {
      return fail({
        status: 422,
        code: 'note-required',
        message: 'A reason is required when a payment failed.',
      });
    }

    const now = new Date().toISOString();
    const after: PayoutLine = {
      ...before,
      status: body.status,
      reason: body.status === 'failed' ? body.reason!.trim() : null,
      paidAt: body.status === 'paid' ? now : null,
      markedByName: auth.user.name,
    };
    state.payoutLines[lineIndex] = after;

    /**
     * A run completes when nothing is left to work.
     *
     * Held lines do not block it: they cannot be paid by this method at all, and a
     * run that could never complete is a run the office stops looking at. They stay
     * counted on it, which is what keeps them visible.
     */
    const lines = linesOf(run.id);
    const outstanding = lines.filter((line) => line.status === 'pending');
    state.payoutRuns[runIndex] = {
      ...run,
      status: outstanding.length === 0 ? 'completed' : run.status,
      completedAt: outstanding.length === 0 ? now : null,
    };

    recordBy(auth, `payout.line.${body.status}`, 'payoutLine', after.id, {
      before: { status: before.status },
      after: {
        status: after.status,
        supplierCode: after.supplierCode,
        amount: after.amount,
        reason: after.reason,
      },
    });

    return HttpResponse.json(after);
  }),

  /* ── M8 Savings ────────────────────────────────────────────────────────── */

  /**
   * The scheme across the factory. Registered before the account routes so the
   * literal segment wins.
   */
  http.get('*/admin/savings/summary', async ({ request }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enableSavings');
    if (gated) return gated;
    const auth = authorize(request, 'billing');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const requested = url.searchParams.get('monthKey');

    const contributionMonths = [
      ...new Set(
        state.savingsLedger
          .filter((entry) => entry.source !== 'openingBalance')
          .map((entry) => entry.monthKey),
      ),
    ].sort();
    const monthKey = requested ?? contributionMonths.at(-1) ?? currentMonthKey;

    /** The running balance per supplier as at the end of a month. */
    const balanceAt = (key: string) => {
      const balances = new Map<string, number>();
      for (const entry of state.savingsLedger) {
        if (entry.monthKey <= key) balances.set(entry.supplierId, entry.balance);
      }
      return round2([...balances.values()].reduce((sum, value) => sum + value, 0));
    };

    const contributionsIn = (key: string) =>
      state.savingsLedger.filter(
        (entry) => entry.monthKey === key && entry.source === 'billDeduction',
      );

    const month = contributionsIn(monthKey);
    const contributed = round2(month.reduce((sum, entry) => sum + entry.amount, 0));
    const kgsThisMonth = roundKg(
      state.bills
        .filter((bill) => bill.monthKey === monthKey && bill.deductions.savings > 0)
        .reduce((sum, bill) => sum + bill.totalKgs, 0),
    );

    const summary: SavingsSummary = {
      monthKey,
      // The factory's liability: this is the suppliers' money, held.
      balanceTotal: balanceAt(monthKey),
      accountCount: state.suppliers.filter((supplier) => supplier.status !== 'closed').length,
      // Opted out is a real answer, not a missing one (`savingsPerKg: 0`).
      optedOutCount: state.suppliers.filter(
        (supplier) => supplier.status !== 'closed' && supplier.savingsPerKg === 0,
      ).length,
      contributedThisMonth: contributed,
      contributingSuppliers: month.length,
      // `null`, not `0`, for a month that has contributed nothing (BR-102).
      averagePerKg: kgsThisMonth > 0 ? round2(contributed / kgsThisMonth) : null,
      // Oldest first — charts read left to right.
      trend: contributionMonths.slice(-6).map((key) => ({
        monthKey: key,
        contributed: round2(contributionsIn(key).reduce((sum, entry) => sum + entry.amount, 0)),
        balanceTotal: balanceAt(key),
      })),
    };

    return HttpResponse.json(summary);
  }),

  /**
   * One supplier's passbook. Registered before `/savings/accounts` — MSW matches
   * whole paths, but keeping the more specific route first is the rule that has
   * already caught two bugs in this file.
   */
  http.get('*/admin/savings/accounts/:supplierId/ledger', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enableSavings');
    if (gated) return gated;
    const auth = authorize(request, 'billing');
    if ('response' in auth) return auth.response;

    const supplier = state.suppliers.find((candidate) => candidate.id === params.supplierId);
    if (!supplier) return fail({ status: 404, code: '404', message: 'No such supplier.' });

    // **Oldest first**, which is part of the wire contract: a passbook is read
    // forward, and a running balance only means something in the order it grew.
    const rows = state.savingsLedger
      .filter((entry) => entry.supplierId === supplier.id)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.id.localeCompare(b.id));

    return HttpResponse.json(paginate(rows, new URL(request.url)));
  }),

  http.get('*/admin/savings/accounts', async ({ request }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enableSavings');
    if (gated) return gated;
    const auth = authorize(request, 'billing');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const optedOut = url.searchParams.get('optedOut');

    const lastContribution = new Map<string, AdminSavingsLedgerEntry>();
    for (const entry of state.savingsLedger) {
      if (entry.source === 'openingBalance') continue;
      lastContribution.set(entry.supplierId, entry);
    }

    let rows: SavingsAccount[] = state.suppliers
      .filter((supplier) => supplier.status !== 'closed')
      .map((supplier) => {
        const latest = lastContribution.get(supplier.id);
        const pending = state.changeRequests.find(
          (candidate) =>
            candidate.supplierId === supplier.id &&
            candidate.type === 'savingsRate' &&
            candidate.status === 'pending',
        );
        return {
          supplierId: supplier.id,
          supplierCode: supplier.supplierCode,
          supplierName: supplier.name,
          // The **active** rate (AC-01) — a pending change is flagged, never applied.
          savingsPerKg: supplier.savingsPerKg,
          balance: supplier.savingsBalance,
          lastContributionMonth: latest?.monthKey ?? null,
          lastContributionAmount: latest?.amount ?? null,
          pendingRateChangeId: pending?.id ?? null,
        };
      });

    if (q) {
      rows = rows.filter(
        (row) =>
          row.supplierCode.toLowerCase().includes(q) || row.supplierName.toLowerCase().includes(q),
      );
    }
    if (optedOut !== null) {
      rows = rows.filter((row) => (row.savingsPerKg === 0) === (optedOut === 'true'));
    }

    // Largest balance first: the accounts the office is asked about are the big ones.
    rows = sortRows(rows, url, (a, b) => b.balance - a.balance);

    return HttpResponse.json(paginate(rows, url));
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

  /* ── M7 Credit queues ──────────────────────────────────────────────────── */

  /**
   * The queue.
   *
   * Every row's eligibility is **recomputed here**, never read from the stored
   * record. A ceiling is a function of leaf and rates, both of which move: a
   * figure written when the request arrived is a figure that was true then, and
   * an approver reading it would be lending against history.
   */
  http.get('*/admin/credit-requests', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'creditRequests');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const facility = url.searchParams.get('facility') as CreditFacility | null;
    const supplierId = url.searchParams.get('supplierId');
    const overCeiling = url.searchParams.get('overCeiling');
    const q = url.searchParams.get('q')?.trim().toLowerCase();

    // A facility this factory does not offer has no queue, and its rows are not
    // hidden in the console — they are absent from the payload (AC-07).
    const flags = flagsOf(request);
    let rows = state.creditRequests
      .filter((row) => flags[CREDIT_FACILITY_FLAGS[row.facility]])
      .map(withCreditEligibility);

    if (status) rows = rows.filter((r) => r.status === status);
    if (facility) rows = rows.filter((r) => r.facility === facility);
    if (supplierId) rows = rows.filter((r) => r.supplierId === supplierId);
    if (overCeiling === 'true') rows = rows.filter((r) => r.amount > r.eligibility.available);
    if (q) {
      rows = rows.filter(
        (r) =>
          r.supplierCode.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q),
      );
    }

    // Oldest first, like every other inbox in the console.
    rows = sortRows(rows, url, (a, b) => a.createdAt.localeCompare(b.createdAt));

    return HttpResponse.json(paginate(rows, url));
  }),

  http.get('*/admin/credit-requests/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'creditRequests');
    if ('response' in auth) return auth.response;

    const found = state.creditRequests.find((r) => r.id === params.id);
    if (!found) return fail({ status: 404, code: '404', message: 'No such request.' });

    const gate = featureGate(request, CREDIT_FACILITY_FLAGS[found.facility]);
    if (gate) return gate;

    return HttpResponse.json(withCreditEligibility(found));
  }),

  ...(['approve', 'reject'] as const).map((verb) =>
    http.post(`*/admin/credit-requests/:id/${verb}`, async ({ request, params }) => {
      await delay(LATENCY_MS);
      const auth = authorize(request, 'creditRequests', 'approve');
      if ('response' in auth) return auth.response;

      const index = state.creditRequests.findIndex((r) => r.id === params.id);
      if (index < 0) return fail({ status: 404, code: '404', message: 'No such request.' });

      const before = state.creditRequests[index]!;

      const gate = featureGate(request, CREDIT_FACILITY_FLAGS[before.facility]);
      if (gate) return gate;

      const body = (await request.json()) as { note?: string; ceilingSeen?: number };
      const note = body.note?.trim() ?? '';

      // AC-06, on both verbs.
      if (note.length < 10) {
        return fail({
          status: 422,
          code: 'note-required',
          message: 'A decision note is required.',
        });
      }

      if (before.status !== 'pending') {
        return fail({
          status: 409,
          code: 'already-decided',
          message: `This request was already ${before.status}.`,
          details: { decidedByName: before.decision?.decidedByName ?? null },
        });
      }

      // BR-501, before anything is derived: who may decide does not depend on
      // what the figures say.
      if (isSelfApproval(auth.user, before.createdById)) {
        return fail({
          status: 409,
          code: 'four-eyes-violation',
          message: 'You raised this request, so you cannot decide it.',
          details: { createdByName: before.createdByName },
        });
      }

      const supplier = state.suppliers.find((s) => s.id === before.supplierId);
      if (!supplier) return fail({ status: 404, code: '404', message: 'No such supplier.' });

      const fresh = eligibilityFor(supplier, before.facility, {
        deliveries: state.deliveries,
      });

      /**
       * BR-310, and **only on approval**.
       *
       * A rejection does not lend anything, so refusing one because the ceiling
       * moved would trap a request in the queue: the figures shift again while the
       * clerk reloads, and the row can never be cleared. An approval is the act
       * that moves money against a specific number, and that number has to still
       * be the one the approver agreed to.
       */
      if (verb === 'approve') {
        if (body.ceilingSeen === undefined || round2(body.ceilingSeen) !== fresh.ceiling) {
          return fail({
            status: 409,
            code: 'stale-eligibility',
            message: 'The ceiling has changed since this queue was loaded.',
            details: { ceilingSeen: body.ceilingSeen ?? null, ceilingNow: fresh.ceiling },
          });
        }

        // Eligibility that never moved, against an amount that was never inside
        // it. A separate refusal from the one above, because the fix is different:
        // this request has to be rejected or re-raised, not reloaded.
        if (before.amount > fresh.available) {
          return fail({
            status: 409,
            code: 'over-ceiling',
            message: 'The amount asked for is more than this supplier may draw.',
            details: {
              amount: before.amount,
              available: fresh.available,
              reasonKey: fresh.reasonKey,
            },
          });
        }
      }

      const status = verb === 'approve' ? 'approved' : 'rejected';
      const after: AdminCreditRequest = {
        ...before,
        status,
        eligibility: fresh,
        decision: {
          note,
          decidedById: auth.user.id,
          decidedByName: auth.user.name,
          decidedAt: new Date().toISOString(),
        },
      };
      state.creditRequests[index] = after;

      /**
       * An approved facility becomes a balance the supplier owes.
       *
       * §11.3: an advance surfaces as a `deductions.advance` line on the next
       * bill, so the two have to agree. Writing it here is what makes the chain
       * real rather than decorative — the next eligibility read has less headroom,
       * and the next bill deducts an instalment against it.
       */
      const supplierIndex = state.suppliers.findIndex((s) => s.id === before.supplierId);
      if (status === 'approved' && supplierIndex >= 0) {
        const current = state.suppliers[supplierIndex]!;
        state.suppliers[supplierIndex] = {
          ...current,
          creditBalances: {
            ...current.creditBalances,
            [before.facility]: round2(current.creditBalances[before.facility] + before.amount),
          },
          pendingRequests: Math.max(0, current.pendingRequests - 1),
        };
      } else if (supplierIndex >= 0) {
        const current = state.suppliers[supplierIndex]!;
        state.suppliers[supplierIndex] = {
          ...current,
          pendingRequests: Math.max(0, current.pendingRequests - 1),
        };
      }

      // AC-09, and the ceiling is part of the record: "approved against a ceiling
      // of X computed at Y" is what settles a dispute about a limit that has moved.
      record({
        actorId: auth.user.id,
        actorName: auth.user.name,
        action: `creditRequest.${verb}`,
        entity: 'creditRequest',
        entityId: before.id,
        before: { status: before.status },
        after: {
          status,
          amount: before.amount,
          facility: before.facility,
          ceiling: fresh.ceiling,
          computedAt: fresh.computedAt,
          note,
        },
      });

      return HttpResponse.json(after);
    }),
  ),

  /* ── M11 News ──────────────────────────────────────────────────────────── */

  http.get('*/admin/news', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableNews');
    if (gate) return gate;
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const incomplete = url.searchParams.get('incomplete');

    let rows = state.news.map((record) => toNewsListItem(record, request));
    if (status) rows = rows.filter((row) => row.status === status);
    if (q) {
      // Matched across **every** language, not the fallback title on the row: an editor
      // searches for what they typed, and they may have typed it in Sinhala.
      rows = rows.filter((row) => {
        const record = state.news.find((candidate) => candidate.id === row.id)!;
        return Object.values(record.translations).some(
          (one) => one && (one.title.toLowerCase().includes(q) || one.body.toLowerCase().includes(q)),
        );
      });
    }
    // The AC-08 working list: live, and falling back for somebody.
    if (incomplete === 'true') {
      rows = rows.filter(
        (row) =>
          row.status === 'published' &&
          (row.missingLanguages.length > 0 || row.staleLanguages.length > 0),
      );
    }

    // Newest first: a feed is read from the top, and the article the office is asking
    // about is almost always the one that just went out.
    rows = sortRows(rows, url, (a, b) =>
      (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt),
    );

    return HttpResponse.json(paginate(rows, url));
  }),

  /**
   * Create. Registered before `/news/:id` — a POST to the collection, so no conflict,
   * but the specific-first habit in this file has already caught two routing bugs.
   */
  http.post('*/admin/news', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableNews');
    if (gate) return gate;
    const auth = authorize(request, 'content', 'write');
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as {
      coverImageUrl?: string;
      translations?: Array<{ lang?: LanguageCode; title?: string; excerpt?: string; body?: string }>;
    };

    const now = new Date().toISOString();
    const translations: ContentTranslations = {};
    for (const one of body.translations ?? []) {
      if (!one.lang) continue;
      const parsed = readTranslationBody(one);
      if (parsed instanceof Response) return parsed;
      translations[one.lang] = {
        lang: one.lang,
        ...parsed,
        updatedAt: now,
        updatedByName: auth.user.name,
      };
    }

    // The fallback is required **at creation**, not only at publish: a record with
    // nothing to fall back to cannot be shown to anybody, so allowing it would only
    // defer the error to somebody else's screen.
    const refusal = requireFallbackCopy(translations, request);
    if (refusal) return refusal;

    const fallback = translations[EDITORIAL_FALLBACK_LANGUAGE]!;
    const base = slugify(fallback.title);
    // Slugs are a link target and must be unique. Suffixed rather than refused: two
    // articles called "August rate" in consecutive years is normal, and an editor
    // should not have to invent a title to get past a validator.
    const slug = state.news.some((record) => record.slug === base)
      ? `${base}-${nextId()}`
      : base;

    const record: NewsRecord = {
      id: `nws-${nextId()}`,
      slug,
      translations,
      coverImageUrl: body.coverImageUrl || undefined,
      status: 'draft',
      publishedAt: null,
      publishedByName: null,
      createdAt: now,
      createdByName: auth.user.name,
    };
    state.news = [record, ...state.news];

    recordBy(auth, 'news.create', 'newsArticle', record.id, {
      after: { slug, languages: Object.keys(translations) },
    });

    return HttpResponse.json(serialiseNews(record, request), { status: 201 });
  }),

  /** The preview. Before `/news/:id` so the literal segment wins. */
  http.get('*/admin/news/:id/preview', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableNews');
    if (gate) return gate;
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const record = state.news.find((candidate) => candidate.id === params.id);
    if (!record) return fail({ status: 404, code: '404', message: 'No such article.' });

    const url = new URL(request.url);
    const lang = (url.searchParams.get('lang') ?? EDITORIAL_FALLBACK_LANGUAGE) as LanguageCode;
    return HttpResponse.json(contentPreview(record.translations, lang));
  }),

  /**
   * Save one language.
   *
   * `PUT`, because writing the Sinhala copy twice is a correction rather than a second
   * translation. Its `updatedAt` is stamped **now**, which is the mechanism staleness is
   * detected by: correcting the English later leaves this timestamp behind it.
   */
  http.put('*/admin/news/:id/translations/:lang', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableNews');
    if (gate) return gate;
    const auth = authorize(request, 'content', 'write');
    if ('response' in auth) return auth.response;

    const lang = String(params.lang) as LanguageCode;
    if (!contentLanguagesOf(request).includes(lang)) {
      // Not a language this factory authors in. Refused rather than stored, because a
      // translation nothing reads is a gap report nobody can trust.
      return fail({
        status: 422,
        code: 'invalid',
        message: `This factory does not author content in ${lang}.`,
        details: { lang, contentLanguages: contentLanguagesOf(request) },
      });
    }

    const index = state.news.findIndex((candidate) => candidate.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such article.' });

    const parsed = readTranslationBody(
      (await request.json()) as { title?: string; excerpt?: string; body?: string },
    );
    if (parsed instanceof Response) return parsed;

    const before = state.news[index]!;
    const previous = before.translations[lang];
    const after = cloneNews(before);
    after.translations[lang] = {
      lang,
      ...parsed,
      updatedAt: new Date().toISOString(),
      updatedByName: auth.user.name,
    };
    state.news[index] = after;

    recordBy(auth, 'news.translation.save', 'newsArticle', after.id, {
      before: previous ? { lang, title: previous.title } : { lang, title: null },
      after: { lang, title: parsed.title },
    });

    return HttpResponse.json(serialiseNews(after, request));
  }),

  ...(['publish', 'unpublish', 'archive'] as const).map((verb) =>
    http.post(`*/admin/news/:id/${verb}`, async ({ request, params }) => {
      await delay(LATENCY_MS);
      const gate = featureGate(request, 'enableNews');
      if (gate) return gate;
      /**
       * `approve`, not `write`.
       *
       * §12.1 gives `content: W` to the editor and `A` to the factory admin, so the
       * person who writes a circular is not the person who puts it in front of every
       * supplier the factory has. There is no four-eyes rule on top of that — the
       * capability split *is* the control here, and unlike money there is no amount to
       * escalate on.
       */
      const auth = authorize(request, 'content', 'approve');
      if ('response' in auth) return auth.response;

      const index = state.news.findIndex((candidate) => candidate.id === params.id);
      if (index < 0) return fail({ status: 404, code: '404', message: 'No such article.' });

      const before = state.news[index]!;

      if (verb === 'publish') {
        if (before.status === 'published') {
          return fail({
            status: 409,
            code: 'already-published',
            message: 'This article is already live.',
            details: { publishedAt: before.publishedAt, publishedByName: before.publishedByName },
          });
        }
        const refusal = requireFallbackCopy(before.translations, request);
        if (refusal) return refusal;
      }
      if (verb === 'unpublish' && before.status !== 'published') {
        return fail({
          status: 409,
          code: 'content-not-published',
          message: 'This article is not live, so there is nothing to take down.',
        });
      }

      const now = new Date().toISOString();
      const after = cloneNews(before);
      after.status = verb === 'publish' ? 'published' : verb === 'archive' ? 'archived' : 'draft';
      if (verb === 'publish') {
        after.publishedAt = now;
        after.publishedByName = auth.user.name;
      }
      state.news[index] = after;

      /**
       * The gaps go **into the audit entry** on a publish.
       *
       * "Who decided a Sinhala supplier could read this in English, and when" is the
       * question AC-08 turns into an argument six months later, and a log that recorded
       * only the publish cannot answer it.
       */
      const gaps = serialiseNews(after, request);
      recordBy(auth, `news.${verb}`, 'newsArticle', after.id, {
        before: { status: before.status },
        after: {
          status: after.status,
          ...(verb === 'publish'
            ? { missingLanguages: gaps.missingLanguages, staleLanguages: gaps.staleLanguages }
            : {}),
        },
      });

      return HttpResponse.json(gaps);
    }),
  ),

  http.patch('*/admin/news/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableNews');
    if (gate) return gate;
    const auth = authorize(request, 'content', 'write');
    if ('response' in auth) return auth.response;

    const index = state.news.findIndex((candidate) => candidate.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such article.' });

    const patch = (await request.json()) as { coverImageUrl?: string | null };
    const before = state.news[index]!;
    const after = cloneNews(before);
    // `null` clears it, `undefined` leaves it — a PATCH that could not remove a cover
    // image would need a second endpoint to do it.
    if ('coverImageUrl' in patch) after.coverImageUrl = patch.coverImageUrl || undefined;
    state.news[index] = after;

    recordBy(auth, 'news.update', 'newsArticle', after.id, {
      before: { coverImageUrl: before.coverImageUrl ?? null },
      after: { coverImageUrl: after.coverImageUrl ?? null },
    });

    return HttpResponse.json(serialiseNews(after, request));
  }),

  http.get('*/admin/news/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableNews');
    if (gate) return gate;
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const record = state.news.find((candidate) => candidate.id === params.id);
    if (!record) return fail({ status: 404, code: '404', message: 'No such article.' });
    return HttpResponse.json(serialiseNews(record, request));
  }),

  /* ── M12 Static content ────────────────────────────────────────────────── */

  /**
   * Every page in the closed set, written or not.
   *
   * **No feature flag.** Terms, privacy and the FAQ are not a feature a factory buys or
   * declines — the app links to them from its own settings screen, and a tenant that
   * could turn them off would ship a binary with dead links in it.
   */
  http.get('*/admin/static-pages', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    // In `STATIC_PAGE_SLUGS` order, which is the order the app's settings screen lists
    // them and therefore the order the office thinks about them.
    const rows = STATIC_PAGE_SLUGS.map((slug) => {
      const record = state.staticPages.find((candidate) => candidate.slug === slug);
      return serialiseStaticPage(
        record ?? {
          slug,
          translations: {},
          status: 'draft',
          publishedAt: null,
          publishedByName: null,
        },
        request,
      );
    });

    return HttpResponse.json(rows);
  }),

  http.get('*/admin/static-pages/:slug/preview', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const record = state.staticPages.find((candidate) => candidate.slug === params.slug);
    if (!record) return fail({ status: 404, code: '404', message: 'No such page.' });

    const url = new URL(request.url);
    const lang = (url.searchParams.get('lang') ?? EDITORIAL_FALLBACK_LANGUAGE) as LanguageCode;
    return HttpResponse.json(contentPreview(record.translations, lang));
  }),

  http.put('*/admin/static-pages/:slug/translations/:lang', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'content', 'write');
    if ('response' in auth) return auth.response;

    const slug = String(params.slug) as StaticPageSlug;
    if (!STATIC_PAGE_SLUGS.includes(slug)) {
      // A closed set: the app links to these slugs, so one invented here is a page
      // nothing can reach.
      return fail({ status: 404, code: '404', message: 'No such page.' });
    }

    const lang = String(params.lang) as LanguageCode;
    if (!contentLanguagesOf(request).includes(lang)) {
      return fail({
        status: 422,
        code: 'invalid',
        message: `This factory does not author content in ${lang}.`,
        details: { lang, contentLanguages: contentLanguagesOf(request) },
      });
    }

    const parsed = readTranslationBody(
      (await request.json()) as { title?: string; excerpt?: string; body?: string },
    );
    if (parsed instanceof Response) return parsed;

    const index = state.staticPages.findIndex((candidate) => candidate.slug === slug);
    const before: StaticPageRecord =
      index >= 0
        ? state.staticPages[index]!
        : { slug, translations: {}, status: 'draft', publishedAt: null, publishedByName: null };

    const after = cloneStaticPage(before);
    const previous = before.translations[lang];
    after.translations[lang] = {
      lang,
      ...parsed,
      updatedAt: new Date().toISOString(),
      updatedByName: auth.user.name,
    };
    if (index >= 0) state.staticPages[index] = after;
    else state.staticPages = [...state.staticPages, after];

    /**
     * Before **and** after on the copy itself, not just the title.
     *
     * This is the audit entry that makes "an edit to a published page is live
     * immediately" a defensible design rather than a shortcut: a wrong change to the
     * terms of supply is reconstructable from the log, by name and with the previous
     * wording, which is what a review step would otherwise have been for.
     */
    recordBy(auth, 'staticPage.translation.save', 'staticPage', slug, {
      before: previous ? { lang, title: previous.title, body: previous.body } : { lang, body: null },
      after: { lang, title: parsed.title, body: parsed.body },
    });

    return HttpResponse.json(serialiseStaticPage(after, request));
  }),

  http.post('*/admin/static-pages/:slug/publish', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'content', 'approve');
    if ('response' in auth) return auth.response;

    const index = state.staticPages.findIndex((candidate) => candidate.slug === params.slug);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such page.' });

    const before = state.staticPages[index]!;
    if (before.status === 'published') {
      return fail({
        status: 409,
        code: 'already-published',
        message: 'This page is already live. Edits to it go out as they are saved.',
        details: { publishedAt: before.publishedAt, publishedByName: before.publishedByName },
      });
    }
    const refusal = requireFallbackCopy(before.translations, request);
    if (refusal) return refusal;

    const after = cloneStaticPage(before);
    after.status = 'published';
    after.publishedAt = new Date().toISOString();
    after.publishedByName = auth.user.name;
    state.staticPages[index] = after;

    const gaps = serialiseStaticPage(after, request);
    recordBy(auth, 'staticPage.publish', 'staticPage', after.slug, {
      before: { status: 'draft' },
      after: { status: 'published', missingLanguages: gaps.missingLanguages },
    });

    return HttpResponse.json(gaps);
  }),

  http.get('*/admin/static-pages/:slug', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const record = state.staticPages.find((candidate) => candidate.slug === params.slug);
    if (!record) return fail({ status: 404, code: '404', message: 'No such page.' });
    return HttpResponse.json(serialiseStaticPage(record, request));
  }),

  /* ── M10 Inquiries ─────────────────────────────────────────────────────── */
  http.get('*/admin/inquiries', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableInquiry');
    if (gate) return gate;

    const auth = authorize(request, 'inquiries');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const supplierId = url.searchParams.get('supplierId');
    const q = url.searchParams.get('q')?.trim().toLowerCase();

    let rows = state.inquiries.map(withInquiryAge);
    if (status) rows = rows.filter((r) => r.status === status);
    if (supplierId) rows = rows.filter((r) => r.supplierId === supplierId);
    if (q) {
      rows = rows.filter(
        (r) =>
          r.supplierCode.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          // The body too: the office searches for what somebody said, not only
          // for who said it, and a subject line of "help" is common.
          r.message.toLowerCase().includes(q),
      );
    }

    rows = sortRows(rows, url, (a, b) => a.createdAt.localeCompare(b.createdAt));

    return HttpResponse.json(paginate(rows, url));
  }),

  http.get('*/admin/inquiries/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableInquiry');
    if (gate) return gate;

    const auth = authorize(request, 'inquiries');
    if ('response' in auth) return auth.response;

    const found = state.inquiries.find((r) => r.id === params.id);
    if (!found) return fail({ status: 404, code: '404', message: 'No such inquiry.' });
    return HttpResponse.json(withInquiryAge(found));
  }),

  /**
   * The answer the supplier reads.
   *
   * `approve` on the capability, not `write`: §12.1 gives inquiries `A` to the
   * clerk and `R` to the manager, which is unusual and deliberate — answering a
   * supplier is counter work, and a manager reading the queue is oversight rather
   * than a second pair of hands.
   */
  http.post('*/admin/inquiries/:id/reply', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableInquiry');
    if (gate) return gate;

    const auth = authorize(request, 'inquiries', 'approve');
    if ('response' in auth) return auth.response;

    const index = state.inquiries.findIndex((r) => r.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such inquiry.' });

    const before = state.inquiries[index]!;
    const { body } = (await request.json()) as { body?: string };
    const text = body?.trim() ?? '';

    if (text.length < 20) {
      return fail({
        status: 422,
        code: 'note-required',
        message: 'A reply is required.',
      });
    }

    // Two clerks, one inbox — the same refusal M9 makes, for the same reason. A
    // second reply would replace the first, and the supplier already read it.
    if (isInquiryClosed(before.status)) {
      return fail({
        status: 409,
        code: 'already-decided',
        message: `This inquiry was already ${before.status}.`,
        details: { repliedByName: before.reply?.repliedByName ?? null },
      });
    }

    const after: AdminInquiry = {
      ...before,
      status: 'resolved',
      reply: {
        body: text,
        repliedById: auth.user.id,
        repliedByName: auth.user.name,
        repliedAt: new Date().toISOString(),
      },
    };
    state.inquiries[index] = after;

    record({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'inquiry.reply',
      entity: 'inquiry',
      entityId: before.id,
      before: { status: before.status },
      after: { status: 'resolved' },
    });

    return HttpResponse.json(after);
  }),

  /** Closing unanswered — a duplicate, a test message, something for the weighing point. */
  http.post('*/admin/inquiries/:id/close', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableInquiry');
    if (gate) return gate;

    const auth = authorize(request, 'inquiries', 'approve');
    if ('response' in auth) return auth.response;

    const index = state.inquiries.findIndex((r) => r.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such inquiry.' });

    const before = state.inquiries[index]!;
    const { note } = (await request.json()) as { note?: string };
    const reason = note?.trim() ?? '';

    if (reason.length < 10) {
      return fail({
        status: 422,
        code: 'note-required',
        message: 'A reason is required to close a message unanswered.',
      });
    }

    if (isInquiryClosed(before.status)) {
      return fail({
        status: 409,
        code: 'already-decided',
        message: `This inquiry was already ${before.status}.`,
      });
    }

    const after: AdminInquiry = {
      ...before,
      status: 'closed',
      closedAt: new Date().toISOString(),
      closedByName: auth.user.name,
      closureNote: reason,
    };
    state.inquiries[index] = after;

    record({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'inquiry.close',
      entity: 'inquiry',
      entityId: before.id,
      before: { status: before.status },
      after: { status: 'closed', note: reason },
    });

    return HttpResponse.json(after);
  }),

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
  /**
   * The money modules reset with everything else, and the order matters less than
   * the completeness: a payout run left over from an earlier test is a `run-exists`
   * refusal in the next one, and a savings entry left behind doubles a balance an
   * assertion is about.
   */
  state.bills = mockBills.map((bill) => ({ ...bill }));
  state.billRuns = mockBillRuns.map((run) => ({ ...run }));
  state.payoutRuns = mockPayoutRuns.map((run) => ({ ...run }));
  state.payoutLines = mockPayoutLines.map((line) => ({ ...line }));
  state.savingsLedger = mockSavingsLedger.map((entry) => ({ ...entry }));
  /**
   * The queues too. A credit request approved in one test leaves the supplier's
   * `creditBalances` raised, which lowers the headroom the next test asserts on —
   * and the failure reads as a wrong ceiling rather than as leaked state.
   */
  state.creditRequests = mockCreditRequests.map((request) => ({ ...request }));
  state.inquiries = mockInquiries.map((inquiry) => ({ ...inquiry }));
  state.audit = [...mockAudit];
  state.sessions.clear();
  state.challenges.clear();
  state.sequence = 1000;
  // The stand-in cookie too, or a signed-in session leaks into the next test and
  // an RBAC assertion passes as the wrong user.
  writeRefreshCookie(null);
}
