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
  AccessLevel,
  AdminBill,
  AdminConsoleUser,
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
  ConfigPatch,
  ConfigUsage,
  ContentPreview,
  ContentTranslation,
  ContentTranslations,
  ConsoleRole,
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
  LockoutCandidate,
  MonthlyRateEntry,
  NotificationAudience,
  NotificationCategory,
  NotificationReach,
  NotificationSend,
  NewsListItem,
  Paged,
  PaymentMethod,
  PayoutLine,
  PayoutRun,
  ReportId,
  ReportResult,
  RuntimeConfig,
  SavingsAccount,
  SavingsSummary,
  StaticPageSlug,
} from '@tfd/domain';
import {
  CREDIT_FACILITY_FLAGS,
  EDITORIAL_FALLBACK_LANGUAGE,
  MAX_CONTENT_BODY_CHARS,
  MAX_CONTENT_TITLE_CHARS,
  MAX_PUSH_BODY_CHARS,
  MAX_PUSH_TITLE_CHARS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  MAX_DELIVERY_BATCH_ROWS,
  MAX_DELIVERY_KG,
  STATIC_PAGE_SLUGS,
  can,
  deductionsBalance,
  isExactKg,
  isInquiryClosed,
  DEFAULT_ROLE_MATRIX,
  DEFAULT_DEDUCTION_RATES,
  deductionRateProblems,
  type DeductionRateChange,
  type DeductionRates,
  DEFAULT_PAYOUT_EXPORT,
  DEFAULT_SAVINGS_POLICY,
  availableToWithdraw,
  colomboMonthKey,
  isWithdrawalWindowOpen,
  pendingWithdrawalTotal,
  withdrawalProblems,
  type SavingsPolicy,
  type SavingsWithdrawal,
  payoutFileName,
  payoutTemplateProblems,
  serialisePayoutFile,
  type PayoutExportLine,
  REPORT_DEFINITIONS,
  REPORT_IDS,
  audienceMatches,
  canAdministerUsers,
  configImpact,
  isConfigPatchAllowed,
  grantsFromRoles,
  isRecognizedCategory,
  isReportId,
  isSelfApproval,
  partitionDevices,
  matrixKeepsRecovery,
  missingReportParams,
  missingTranslations,
  owesMfa,
  monthKeyOf,
  publishability,
  resolveTranslation,
  slugify,
  staleTranslations,
  wouldLockOut,
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
  mockDevicesBySupplier,
  mockNews,
  mockNotificationSends,
  mockNotificationTriggers,
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
  /**
   * The console's own users, mutable.
   *
   * Copied rather than aliased, so `resetMockState()` can restore it: M15 suspends accounts
   * and rewrites roles, and a suspension leaking into the next test would leave a suite
   * unable to sign in as anybody.
   *
   * **Authentication reads this, not the fixture** — see `bearer()`. That is what makes a
   * suspension and a role change take effect rather than being cosmetic.
   */
  users: mockUsers.map((user) => ({ ...user, roles: [...user.roles] })),
  /** `null` until the factory edits it, at which point it becomes the authority. */
  /**
   * Savings withdrawals asked for and not yet paid (§21.9).
   *
   * Requests, not movements: the balance does not change until the bill that pays one is
   * published, because the savings ledger is derived from published bills and nothing else.
   */
  savingsWithdrawals: [] as SavingsWithdrawal[],
  /**
   * §21.10's rates, and the changes waiting for a second person.
   *
   * `null` until a factory sets its own — `DEFAULT_DEDUCTION_RATES` is what a factory that
   * has never touched them is running on, and the screen says as much rather than
   * presenting a guess as the factory's own decision.
   */
  deductionRates: null as DeductionRates | null,
  deductionRateChanges: [] as DeductionRateChange[],
  roleMatrix: null as Record<ConsoleRole, Record<Capability, AccessLevel>> | null,
  roleMatrixUpdatedAt: null as string | null,
  roleMatrixUpdatedByName: null as string | null,
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
  /**
   * The `client_config` row per tenant, deep-cloned.
   *
   * Deep, because a config is nested three levels and a shallow copy would let M14 mutate
   * the seed — so `resetMockState()` would hand the mutated object back and a test that
   * turned a flag off would leave it off for every test after it.
   */
  configs: {} as Record<string, RuntimeConfig>,
  /** Bumped on every save, so an `ETag` cannot answer `304` with the pre-edit row. */
  configRevisions: {} as Record<string, number>,
  notificationTriggers: mockNotificationTriggers.map((trigger) => ({ ...trigger })),
  notificationSends: mockNotificationSends.map((send) => ({ ...send })),
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





/* ─────────────────────── M16 report helpers ─────────────────────── */

/**
 * The four reports, each one a query over live state.
 *
 * Written as one function returning columns **with** rows, because the API is the only thing
 * that knows whether a number is money, kilos or a count — and a grid that guessed would print
 * `LKR 412.00` over a supplier count. Totals are per-report rather than derived from the
 * column types: summing kilos is a fact, summing a percentage is nonsense.
 */
function runReport(
  id: ReportId,
  params: { monthKey?: string; from?: string; to?: string; dormantMonths?: number },
): Pick<ReportResult, 'id' | 'columns' | 'rows' | 'totals'> {
  switch (id) {
    /**
     * The month's own figures, in the order the office asks for them: how much leaf, at what
     * rate, worth what, of which how much is payable and how much is held as savings.
     */
    case 'monthSummary': {
      const monthKey = params.monthKey!;
      const record = state.months[monthKey];
      const bills = state.bills.filter((bill) => bill.monthKey === monthKey);
      const rows = state.deliveries.filter((row) => row.monthKey === monthKey && !row.voidedAt);
      const totals = summariseKgs(rows.map((row) => ({ supplierId: row.supplierId, kgs: row.kgs })));

      return {
        id,
        columns: [
          // `metricKey`, not `text`: the row label is a key under `reports.metric.*`, and
          // running it through the console as literal prose is how `reports.metric.5091`
          // happened to a completely different column that was also typed `text`.
          { key: 'metric', labelKey: 'reports.column.metric', type: 'metricKey' },
          { key: 'value', labelKey: 'reports.column.value', type: 'text' },
        ],
        // A two-column shape, because this report is a set of unrelated figures rather than a
        // table of like things — one row per metric reads as a summary, and a single wide row
        // reads as a spreadsheet nobody scrolls.
        rows: [
          // `null` rather than the string `'unknown'`: the console already renders a `null`
          // value as an em dash, and a month record should always exist for a month this
          // picker offered — inventing a translatable "unknown" state for a case that should
          // not occur is worse than the em dash.
          { metric: 'stage', value: record?.stage ?? null },
          { metric: 'totalKgs', value: totals.totalKgs },
          { metric: 'supplierCount', value: totals.supplierCount },
          { metric: 'deliveryCount', value: totals.rowCount },
          { metric: 'ratePerKg', value: record?.rate?.ratePerKg ?? null },
          { metric: 'extraRatePerKg', value: record?.rate?.extraRatePerKg ?? null },
          { metric: 'billCount', value: bills.length },
          {
            metric: 'grossTotal',
            value: round2(bills.reduce((sum, bill) => sum + (bill.grossAmount ?? 0), 0)),
          },
          {
            metric: 'payableTotal',
            value: round2(bills.reduce((sum, bill) => sum + (bill.finalBalance ?? 0), 0)),
          },
          {
            metric: 'savingsTotal',
            value: round2(bills.reduce((sum, bill) => sum + bill.deductions.savings, 0)),
          },
        ],
      };
    }

    /** Where the leaf came from. The one report a weighing supervisor asks for by name. */
    case 'leafByCollectionPoint': {
      const monthKey = params.monthKey!;
      const rows = state.deliveries.filter((row) => row.monthKey === monthKey && !row.voidedAt);

      const byPoint = new Map<string, { kgs: number; suppliers: Set<string>; deliveries: number }>();
      for (const row of rows) {
        const entry = byPoint.get(row.collectionPoint) ?? {
          kgs: 0,
          suppliers: new Set<string>(),
          deliveries: 0,
        };
        entry.kgs = roundKg(entry.kgs + row.kgs);
        entry.suppliers.add(row.supplierId);
        entry.deliveries += 1;
        byPoint.set(row.collectionPoint, entry);
      }

      const out = [...byPoint.entries()]
        .map(([point, entry]) => ({
          collectionPoint: point,
          totalKgs: entry.kgs,
          supplierCount: entry.suppliers.size,
          deliveryCount: entry.deliveries,
          // Mean kilos per delivery: the figure that shows one point weighing very
          // differently from the others, which is what a supervisor is looking for.
          meanKgs: entry.deliveries === 0 ? 0 : roundKg(entry.kgs / entry.deliveries),
        }))
        .sort((a, b) => b.totalKgs - a.totalKgs);

      return {
        id,
        columns: [
          { key: 'collectionPoint', labelKey: 'reports.column.point', type: 'text' },
          { key: 'totalKgs', labelKey: 'reports.column.kgs', type: 'kg' },
          { key: 'supplierCount', labelKey: 'reports.column.suppliers', type: 'count' },
          { key: 'deliveryCount', labelKey: 'reports.column.deliveries', type: 'count' },
          { key: 'meanKgs', labelKey: 'reports.column.meanKgs', type: 'kg' },
        ],
        rows: out,
        totals: {
          totalKgs: roundKg(out.reduce((sum, row) => sum + row.totalKgs, 0)),
          deliveryCount: out.reduce((sum, row) => sum + row.deliveryCount, 0),
          // Deliberately **no `supplierCount` total**: a supplier who delivers to two points
          // would be counted twice, and a sum that double-counts people is worse than none.
        },
      };
    }

    /**
     * Registered and not supplying (§19.2).
     *
     * The report the office uses to decide who to telephone, so it carries the balances too —
     * a dormant supplier who is owed savings is a different conversation from one who is not.
     */
    case 'dormantSuppliers': {
      const months = params.dormantMonths!;
      const cutoff = new Date(Date.now() - months * 30 * 86_400_000).toISOString();

      const out = state.suppliers
        .filter((supplier) => supplier.status !== 'closed')
        .filter((supplier) => !supplier.lastDeliveryAt || supplier.lastDeliveryAt < cutoff)
        .map((supplier) => ({
          supplierCode: supplier.supplierCode,
          name: supplier.name,
          collectionPoint: supplier.collectionPoint,
          // `null` is a real value here, and the one that matters most: a supplier who has
          // *never* delivered is a registration that never became a supply relationship.
          lastDeliveryAt: supplier.lastDeliveryAt,
          savingsBalance: supplier.savingsBalance,
          creditOutstanding: round2(
            supplier.creditBalances.advance +
              supplier.creditBalances.loan +
              supplier.creditBalances.manure,
          ),
        }))
        .sort((a, b) => (a.lastDeliveryAt ?? '').localeCompare(b.lastDeliveryAt ?? ''));

      return {
        id,
        columns: [
          { key: 'supplierCode', labelKey: 'reports.column.code', type: 'text' },
          { key: 'name', labelKey: 'reports.column.name', type: 'text' },
          { key: 'collectionPoint', labelKey: 'reports.column.point', type: 'text' },
          { key: 'lastDeliveryAt', labelKey: 'reports.column.lastDelivery', type: 'date' },
          { key: 'savingsBalance', labelKey: 'reports.column.savings', type: 'money' },
          { key: 'creditOutstanding', labelKey: 'reports.column.credit', type: 'money' },
        ],
        rows: out,
        totals: {
          savingsBalance: round2(out.reduce((sum, row) => sum + row.savingsBalance, 0)),
          creditOutstanding: round2(out.reduce((sum, row) => sum + row.creditOutstanding, 0)),
        },
      };
    }

    /**
     * App adoption and channel shift — *"the two KPIs that justify the project"* (§19.3).
     *
     * Measured as the share of requests that arrived from the app rather than being keyed in
     * by the office, which is only measurable because every request carries `channel`. That
     * column exists for this report and nothing else.
     */
    case 'channelShift': {
      const { from, to } = params;
      const inWindow = (createdAt: string) => {
        const monthKey = createdAt.slice(0, 7);
        return monthKey >= from! && monthKey <= to!;
      };

      const buckets = new Map<string, { app: number; office: number }>();
      const add = (createdAt: string, channel: 'app' | 'office') => {
        if (!inWindow(createdAt)) return;
        const key = createdAt.slice(0, 7);
        const entry = buckets.get(key) ?? { app: 0, office: 0 };
        entry[channel] += 1;
        buckets.set(key, entry);
      };

      // Every queue that carries a channel. Counted together, because the KPI is about
      // suppliers using the app at all rather than about any one request type.
      for (const request of state.changeRequests) add(request.createdAt, request.channel);
      for (const request of state.creditRequests) add(request.createdAt, request.channel);
      for (const inquiry of state.inquiries) add(inquiry.createdAt, inquiry.channel);

      const out = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, entry]) => {
          const total = entry.app + entry.office;
          return {
            monthKey,
            fromApp: entry.app,
            fromOffice: entry.office,
            total,
            // `null`, not `0`, for a month with no requests: a share of nothing is not zero
            // per cent, and a chart that plotted it as such would show adoption collapsing.
            appShare: total === 0 ? null : round2((entry.app / total) * 100),
          };
        });

      return {
        id,
        columns: [
          { key: 'monthKey', labelKey: 'reports.column.month', type: 'month' },
          { key: 'fromApp', labelKey: 'reports.column.fromApp', type: 'count' },
          { key: 'fromOffice', labelKey: 'reports.column.fromOffice', type: 'count' },
          { key: 'total', labelKey: 'reports.column.total', type: 'count' },
          { key: 'appShare', labelKey: 'reports.column.appShare', type: 'percent' },
        ],
        rows: out,
        totals: {
          fromApp: out.reduce((sum, row) => sum + row.fromApp, 0),
          fromOffice: out.reduce((sum, row) => sum + row.fromOffice, 0),
          total: out.reduce((sum, row) => sum + row.total, 0),
          // No `appShare` total: averaging percentages across months of different sizes gives
          // a figure that is not the overall share, and the office would quote it.
        },
      };
    }
  }
}

/* ─────────────────── M15 users & roles helpers ─────────────────── */

/**
 * The role matrix this factory is actually using.
 *
 * Starts as the shipped default and becomes the tenant's own the first time it is edited —
 * which is `rbac.ts`'s doc comment made true rather than aspirational: *"the table above is
 * the offline default. The authority is the `grants` object the server sends."*
 */
function roleMatrix(): Record<ConsoleRole, Record<Capability, AccessLevel>> {
  /**
   * **Read-only: this must not materialise `state.roleMatrix`.**
   *
   * It used to be `state.roleMatrix ??= clone(DEFAULT)`, which meant the first *read* of the
   * matrix set it — and `customised` is `state.roleMatrix !== null`, so simply opening the
   * screen reported the factory as having changed its roles. The flag exists to tell an
   * administrator whether this factory has diverged from the shipped table; one that turns
   * itself on when looked at answers nothing.
   */
  return state.roleMatrix ?? DEFAULT_ROLE_MATRIX;
}

/** A user as M15 lists them: the record, plus what it would cost to take them away. */
function toAdminUser(user: MockUser): AdminConsoleUser {
  const matrix = roleMatrix();
  const candidates: LockoutCandidate[] = state.users.map((one) => ({
    id: one.id,
    roles: one.roles,
    status: one.status,
  }));
  const self = candidates.find((one) => one.id === user.id)!;
  const others = candidates.filter((one) => one.id !== user.id);

  const { password: _password, grants: _grants, ...rest } = user;
  return {
    ...rest,
    canAdministerUsers: canAdministerUsers(self, matrix),
    owesMfa: owesMfa(user),
    /**
     * Derived, not stored, and derived **per read**: "is this the last administrator" stops
     * being true the moment somebody else is given the role, and a stored flag would go on
     * withholding the suspend button afterwards.
     */
    isLastAdministrator: wouldLockOut({ ...self, status: 'suspended' }, others, matrix),
  };
}

/** The lockout refusal, with the reason in `details` so the screen can name it. */
function lockoutRefusal(details: unknown) {
  return fail({
    status: 409,
    code: 'last-admin',
    message: 'That would leave nobody able to administer users.',
    details,
  });
}

/* ─────────────────── M14 configuration helpers ─────────────────── */

/**
 * The counts a config change is judged against.
 *
 * Computed from live state on every read rather than stored, because every one of them is
 * the answer to "would this change hide something": a stored figure would let a factory
 * turn savings off the moment after the last balance was created.
 */
function configUsage(): ConfigUsage {
  const deliveriesByPoint: Record<string, number> = {};
  for (const row of state.deliveries) {
    if (row.voidedAt) continue;
    deliveriesByPoint[row.collectionPoint] = (deliveriesByPoint[row.collectionPoint] ?? 0) + 1;
  }

  const suppliersByBank: Record<string, number> = {};
  for (const supplier of state.suppliers) {
    const bank = supplier.bankDetails?.bankName;
    if (bank) suppliersByBank[bank] = (suppliersByBank[bank] ?? 0) + 1;
  }

  const contentByLanguage: Partial<Record<LanguageCode, number>> = {};
  for (const record of [...state.news, ...state.staticPages]) {
    for (const [lang, translation] of Object.entries(record.translations)) {
      if (translation && translation.title.trim()) {
        contentByLanguage[lang as LanguageCode] = (contentByLanguage[lang as LanguageCode] ?? 0) + 1;
      }
    }
  }

  return {
    savingsBalances: state.suppliers.filter((supplier) => supplier.savingsBalance > 0).length,
    openPayoutRuns: state.payoutRuns.filter((run) => run.status !== 'completed').length,
    outstandingCredit: {
      advance: round2(state.suppliers.reduce((sum, s) => sum + s.creditBalances.advance, 0)),
      loan: round2(state.suppliers.reduce((sum, s) => sum + s.creditBalances.loan, 0)),
      manure: round2(state.suppliers.reduce((sum, s) => sum + s.creditBalances.manure, 0)),
    },
    deliveriesByPoint,
    suppliersByBank,
    contentByLanguage,
  };
}

/**
 * The tenant's live config — the mock's `client_config` row.
 *
 * **`tenantId` is stamped with the tenant the row is being served for**, and that is not
 * cosmetic. A tenant outside the fixture (Vitest resolves to `base`, since jsdom's hostname
 * carries no subdomain) falls back to Galaboda's row as a stand-in — and without this line
 * that row goes on claiming to *be* Galaboda. The console then displays one factory id while
 * the API keys its audit entries on another, which is precisely the second-source-of-truth
 * problem `tenant-immutable` exists to refuse. Found by the M14 audit test, not by reading.
 */
function tenantConfig(request: Request): RuntimeConfig {
  const id = tenantOf(request);
  if (!state.configs[id]) {
    const source = mockConfigs[id] ?? mockConfigs.galaboda!;
    state.configs[id] = { ...(JSON.parse(JSON.stringify(source)) as RuntimeConfig), tenantId: id };
  }
  return state.configs[id]!;
}

/* ─────────────────── M13 notification helpers ─────────────────── */

/**
 * What this tenant is allowed to send at all.
 *
 * `hillcountry` has `enablePushNotifications: true` and **no `push` block**, which is a
 * real state rather than a fixture oversight: the flag is on and nobody has configured
 * the categories. The console must say so — `push-not-configured` — rather than sending
 * into a void or crashing on an undefined.
 *
 * Read from **live state**, because configuring it is M14's job and a comment that says so
 * while this function read the seed would be describing something that could not happen.
 */
function pushConfigOf(request: Request) {
  const config = tenantConfig(request);
  return config.push ?? null;
}

/** Resolve an audience to suppliers, then to devices, honouring per-device consent. */
function resolveReach(
  request: Request,
  category: NotificationCategory,
  audience: NotificationAudience,
): NotificationReach {
  const suppliers = state.suppliers.filter((supplier) =>
    audienceMatches(
      { id: supplier.id, collectionPoint: supplier.collectionPoint, status: supplier.status },
      audience,
    ),
  );

  let reachable = 0;
  let suppressed = 0;
  let withoutDevice = 0;

  for (const supplier of suppliers) {
    const devices = mockDevicesBySupplier[supplier.id] ?? [];
    if (devices.length === 0) {
      // Counted, because "reached 240 of 300" is only meaningful if the office knows how
      // many of the other 60 never installed the app at all.
      withoutDevice += 1;
      continue;
    }
    const split = partitionDevices(devices, category);
    reachable += split.reachable.length;
    suppressed += split.suppressed.length;
  }

  void request;
  return {
    targetedSuppliers: suppliers.length,
    reachableDevices: reachable,
    suppressedDevices: suppressed,
    suppliersWithoutDevice: withoutDevice,
  };
}

/** The refusals every send shares, composed or automatic. */
function checkSendable(
  request: Request,
  category: string,
): { push: NonNullable<ReturnType<typeof pushConfigOf>> } | { response: Response } {
  const push = pushConfigOf(request);
  if (!push) {
    return {
      response: fail({
        status: 409,
        code: 'push-not-configured',
        message: 'This factory has push turned on but no categories configured.',
      }),
    };
  }
  /**
   * The refusal that matters most, and the one with no feedback loop behind it: the app
   * **drops** a push whose category it does not recognize rather than opening an
   * arbitrary screen. A send the console called successful would reach nobody and report
   * nothing at all.
   */
  if (!isRecognizedCategory(category)) {
    return {
      response: fail({
        status: 422,
        code: 'unknown-category',
        message: 'The app would drop a notification in that category.',
        details: { category, recognized: NOTIFICATION_CATEGORIES },
      }),
    };
  }
  if (!push.categories.includes(category)) {
    return {
      response: fail({
        status: 409,
        code: 'category-disabled',
        message: 'This factory does not send that category.',
        details: { category, categories: push.categories },
      }),
    };
  }
  return { push };
}

/**
 * Fire an automatic notification, if this factory has that trigger on.
 *
 * Called from the module that owns the event — `month.publish`, `news.publish` and the
 * two decision paths — rather than from a scheduler watching the audit log. The event is
 * the fact; whether it notifies is policy, and the policy lives in one row.
 *
 * **Never throws and never blocks.** A push that could not be sent must not roll back the
 * month it was announcing: publishing is irreversible, and a notification failure after
 * that point would leave the console refusing an act the server had already committed.
 * The failure is recorded on the send instead, which is what the log is for.
 */
function fireAutomatic(
  request: Request,
  category: NotificationCategory,
  content: { title: string; body: string; entity: string; entityId: string },
  audience: NotificationAudience = { kind: 'allSuppliers' },
): NotificationSend | null {
  if (!flagsOf(request).enablePushNotifications) return null;

  const trigger = state.notificationTriggers.find((one) => one.category === category);
  if (!trigger?.enabled) return null;

  const push = pushConfigOf(request);
  if (!push || !push.categories.includes(category)) return null;

  const reach = resolveReach(request, category, audience);
  const now = new Date().toISOString();

  const send: NotificationSend = {
    id: `ntf-${nextId()}`,
    category,
    origin: 'automatic',
    title: content.title,
    body: content.body,
    audience,
    entity: content.entity,
    entityId: content.entityId,
    targetedSuppliers: reach.targetedSuppliers,
    reachableDevices: reach.reachableDevices,
    suppressedDevices: reach.suppressedDevices,
    // No recipients is **not** a failure for an automatic send: a month published at a
    // factory where nobody has installed the app is a normal month, and a red row in the
    // log would train the office to ignore red rows.
    status: 'sent',
    createdById: null,
    createdByName: null,
    createdAt: now,
    sentAt: now,
    failureReason: null,
  };

  state.notificationSends = [send, ...state.notificationSends];
  return send;
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
  // From live state, not the seed: adding or removing a language in M14 has to change what
  // counts as a gap, or the impact list is warning about a consequence that never arrives.
  return tenantConfig(request).localization.contentLanguages;
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
/** The rates in force. Read-only — must not materialise, or `customised` would lie. */
function activeDeductionRates(): DeductionRates {
  return state.deductionRates ?? DEFAULT_DEDUCTION_RATES;
}

/** This factory's savings rules, defaulted for a row that predates §21.9's answer. */
function savingsPolicyOf(request: Request): SavingsPolicy {
  const savings = tenantConfig(request).savings;
  return {
    withdrawalMonth: savings.withdrawalMonth ?? DEFAULT_SAVINGS_POLICY.withdrawalMonth,
    annualInterestRate: savings.annualInterestRate ?? DEFAULT_SAVINGS_POLICY.annualInterestRate,
  };
}

/** Outstanding requests for one supplier — what the next bill will have to carry. */
function pendingWithdrawalsFor(supplierId: string): SavingsWithdrawal[] {
  return state.savingsWithdrawals.filter(
    (one) => one.supplierId === supplierId && one.status === 'pending',
  );
}

/**
 * Withdrawals settled by publishing a month (§21.9).
 *
 * Runs beside `postSavingsFor` and for the same reason: publishing is the one event that
 * turns a bill into something the supplier has been given, so it is the only moment a
 * passbook should move. A withdrawal credited at *request* time would take a supplier's
 * balance down weeks before they were paid.
 *
 * The entry is **negative**, which is what `SavingsLedgerEntry` documents — positive is a
 * contribution, negative a withdrawal — so the running balance needs no special case.
 */
function settleWithdrawalsFor(monthKey: string, publishedAt: string): number {
  let settled = 0;

  for (const bill of state.bills.filter((one) => one.monthKey === monthKey)) {
    if (bill.savingsWithdrawal <= 0) continue;

    for (const request of pendingWithdrawalsFor(bill.supplierId)) {
      // Idempotent, like the contribution above: a replayed publish must not take a
      // supplier's savings twice, and this is money.
      if (state.savingsLedger.some((entry) => entry.note === request.id)) continue;

      const balance = round2(savingsBalanceOf(bill.supplierId) - request.amount);
      state.savingsLedger.push({
        id: `sav-${nextId()}`,
        supplierId: bill.supplierId,
        monthKey,
        month: bill.month,
        amount: -request.amount,
        balance,
        source: 'withdrawal',
        billId: bill.id,
        recordedAt: publishedAt,
        // The request id, so the passbook row and the request are one another's evidence.
        note: request.id,
      });

      const index = state.suppliers.findIndex((supplier) => supplier.id === bill.supplierId);
      if (index >= 0) state.suppliers[index] = { ...state.suppliers[index]!, savingsBalance: balance };

      const at = state.savingsWithdrawals.findIndex((one) => one.id === request.id);
      if (at >= 0) {
        state.savingsWithdrawals[at] = {
          ...request,
          status: 'settled',
          settledBillId: bill.id,
          settledMonthKey: monthKey,
        };
      }
      settled += 1;
    }
  }

  return settled;
}

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
  /**
   * `state.users`, not the fixture.
   *
   * M15 suspends accounts and changes roles, and both have to *mean* something: a suspended
   * user must stop being able to act, and a re-roled one must get their new grants on the
   * next request rather than at the next deploy. Reading the immutable fixture here would
   * have made every M15 write cosmetic — the screen would say "suspended" and the account
   * would carry on working.
   */
  return state.users.find((u) => u.id === userId) ?? null;
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
/**
 * This tenant's flags, from **live state** — which is what makes AC-07 more than a fixture.
 *
 * It used to read the seed, so a flag turned off in M14 removed the sidebar row and the
 * route while every endpoint behind them went on answering. That is precisely the half of
 * AC-07 the criterion exists to insist on ("the surface *and* the endpoint"), and it made
 * the answer depend on whether some fixture tenant happened to have the flag off. Now any
 * flag can be turned off in the console and the endpoint refuses — see the AC-07 case in
 * `configuration.test.ts`.
 */
function flagsOf(request: Request) {
  return tenantConfig(request).flags;
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
  /* ── M16 Reports ───────────────────────────────────────────────────────── */

  /**
   * The reports this factory can run. Registered before `/admin/reports/:id`.
   *
   * Served rather than hardcoded in the console, because which reports exist is a property of
   * the warehouse behind them (§19.1) — and when that lands, the list grows without a console
   * release.
   */
  http.get('*/admin/reports', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enableReports');
    if (gate) return gate;
    const auth = authorize(request, 'reports');
    if ('response' in auth) return auth.response;

    /**
     * The months come with the list, behind the `reports` grant rather than `billing`.
     *
     * The factory administrator holds `reports: R` and `billing: none` (§12.1), so a picker
     * fed from `GET /admin/bill-months` left the one role that owns this section unable to
     * run a month report at all — see `ReportCatalogue`.
     */
    return HttpResponse.json({
      reports: Object.values(REPORT_DEFINITIONS),
      months: Object.keys(state.months).sort().reverse(),
    });
  }),

  /**
   * Run one.
   *
   * **Every figure is derived from live state at request time**, which is the whole reason
   * these four exist and nothing else does: each is a query anybody can re-run against the
   * records it came from. A stored result would be a second answer waiting to disagree with
   * them — the same argument that keeps a bill a read model over deliveries and a rate.
   *
   * §19.5 says a report should run off a read replica so a month-close query does not compete
   * with a clerk entering deliveries. Here it reads the same store; that is a scaling gap and
   * it is recorded in status.md rather than pretended away.
   */
  http.get('*/admin/reports/:id', async ({ request, params }) => {
    await delay(LATENCY_MS * 2);
    const gate = featureGate(request, 'enableReports');
    if (gate) return gate;
    const auth = authorize(request, 'reports');
    if ('response' in auth) return auth.response;

    const id = String(params.id);
    if (!isReportId(id)) {
      return fail({
        status: 404,
        code: '404',
        message: 'No such report.',
        details: { reports: REPORT_IDS },
      });
    }

    const url = new URL(request.url);
    const runParams = {
      monthKey: url.searchParams.get('monthKey') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      dormantMonths: url.searchParams.get('dormantMonths')
        ? Number(url.searchParams.get('dormantMonths'))
        : undefined,
    };

    const missing = missingReportParams(id, runParams);
    if (missing.length > 0) {
      // An empty grid would read as "nothing that month". A refusal says what is missing.
      return fail({
        status: 422,
        code: 'invalid',
        message: 'That report needs more than it was given.',
        details: { missing },
      });
    }

    return HttpResponse.json({
      ...runReport(id, runParams),
      generatedAt: new Date().toISOString(),
      params: runParams,
    });
  }),

  /* ── M15 Users & roles ─────────────────────────────────────────────────── */

  /**
   * The §12.1 matrix, as served. Registered before `/admin/roles/:role` is irrelevant
   * (different methods) but before `/admin/users` matters not at all — kept adjacent so the
   * module reads in one place.
   */
  http.get('*/admin/roles', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'usersAndRoles');
    if ('response' in auth) return auth.response;

    return HttpResponse.json({
      matrix: roleMatrix(),
      // Whether this factory has diverged from the shipped table, so the screen can say so
      // rather than leaving a reader to compare fifteen rows against a document.
      customised: state.roleMatrix !== null,
      updatedAt: state.roleMatrixUpdatedAt,
      updatedByName: state.roleMatrixUpdatedByName,
    });
  }),

  /**
   * Edit one role's grants — **the promise rbac.md makes.** §12.1 is data, not code.
   *
   * The refusal here is the lockout nobody thinks of: strip `usersAndRoles` from every role
   * and the factory is locked out with every user still holding the roles they had. Not one
   * user record changes, so a check written per user would miss it entirely.
   */
  http.put('*/admin/roles/:role', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'usersAndRoles', 'write');
    if ('response' in auth) return auth.response;

    const role = String(params.role) as ConsoleRole;
    if (!(role in DEFAULT_ROLE_MATRIX)) {
      // A grant nothing can hold is a permission nobody has.
      return fail({
        status: 422,
        code: 'unknown-role',
        message: 'No such role.',
        details: { role, roles: Object.keys(DEFAULT_ROLE_MATRIX) },
      });
    }

    const { grants } = (await request.json()) as { grants: Record<Capability, AccessLevel> };
    const current = roleMatrix();
    const proposed = { ...current, [role]: grants };

    if (!matrixKeepsRecovery(proposed)) {
      return lockoutRefusal({ role, reason: 'no role would grant usersAndRoles' });
    }

    const before = current[role];
    state.roleMatrix = proposed;
    state.roleMatrixUpdatedAt = new Date().toISOString();
    state.roleMatrixUpdatedByName = auth.user.name;

    /**
     * Audited with the whole row before and after.
     *
     * A permission change is the one edit whose consequence is invisible until somebody is
     * refused something months later, and "who widened this, and from what" is the only
     * question that gets asked about it.
     */
    recordBy(auth, 'role.update', 'role', role, { before, after: grants });

    return HttpResponse.json({
      matrix: state.roleMatrix,
      customised: true,
      updatedAt: state.roleMatrixUpdatedAt,
      updatedByName: state.roleMatrixUpdatedByName,
    });
  }),

  http.get('*/admin/users', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'usersAndRoles');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');

    let rows = state.users.map(toAdminUser);
    if (q) {
      rows = rows.filter(
        (one) => one.name.toLowerCase().includes(q) || one.email.toLowerCase().includes(q),
      );
    }
    if (role) rows = rows.filter((one) => one.roles.includes(role as ConsoleRole));
    if (status) rows = rows.filter((one) => one.status === status);

    // Suspended last, then by name: an office reads this list to find a person, and the
    // people who can still sign in are the ones being looked for.
    rows = sortRows(rows, url, (a, b) => {
      if ((a.status === 'active') !== (b.status === 'active')) return a.status === 'active' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return HttpResponse.json(paginate(rows, url));
  }),

  http.post('*/admin/users', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'usersAndRoles', 'write');
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as { name?: string; email?: string; roles?: ConsoleRole[] };
    const name = body.name?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';

    if (!name || !email) {
      return fail({ status: 422, code: 'invalid', message: 'A name and an email are required.' });
    }
    // The address is the identity a session is issued against, so two of them is two people.
    if (state.users.some((one) => one.email.toLowerCase() === email)) {
      return fail({ status: 409, code: 'email-taken', message: 'That email already has an account.' });
    }
    if (!body.roles?.length) {
      return fail({ status: 422, code: 'invalid', message: 'A user needs at least one role.' });
    }
    const unknown = body.roles.filter((role) => !(role in DEFAULT_ROLE_MATRIX));
    if (unknown.length > 0) {
      return fail({ status: 422, code: 'unknown-role', message: 'No such role.', details: { unknown } });
    }

    const created: MockUser = {
      id: `usr-${nextId()}`,
      name,
      email,
      factoryId: tenantOf(request),
      roles: body.roles,
      /**
       * **Never enrolled at creation**, whatever roles they are given.
       *
       * A user cannot enrol a second factor before they have an account, so refusing to
       * create a manager without one would make the senior roles unassignable. The
       * obligation is reported instead (`owesMfa`) and the sign-in is what enforces it.
       */
      mfaEnrolled: false,
      lastLoginAt: null,
      status: 'active',
      password: MOCK_PASSWORD,
      grants: grantsFromRoles(body.roles),
    };
    state.users = [...state.users, created];

    recordBy(auth, 'user.create', 'consoleUser', created.id, {
      after: { name, email, roles: created.roles },
    });

    return HttpResponse.json(toAdminUser(created), { status: 201 });
  }),

  http.patch('*/admin/users/:id', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'usersAndRoles', 'write');
    if ('response' in auth) return auth.response;

    const index = state.users.findIndex((one) => one.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such user.' });

    const before = state.users[index]!;
    const patch = (await request.json()) as { name?: string; roles?: ConsoleRole[] };

    if (patch.roles) {
      // Refused even when it would be safe: editing your own roles mid-session is never what
      // was meant, and the person it strands is the one doing the work.
      if (before.id === auth.user.id) {
        return fail({
          status: 409,
          code: 'self-modification',
          message: 'You cannot change your own roles.',
          details: { what: 'roles' },
        });
      }
      const unknown = patch.roles.filter((role) => !(role in DEFAULT_ROLE_MATRIX));
      if (unknown.length > 0) {
        return fail({ status: 422, code: 'unknown-role', message: 'No such role.', details: { unknown } });
      }
      if (patch.roles.length === 0) {
        return fail({ status: 422, code: 'invalid', message: 'A user needs at least one role.' });
      }

      const candidates: LockoutCandidate[] = state.users.map((one) => ({
        id: one.id,
        roles: one.roles,
        status: one.status,
      }));
      const next = { id: before.id, roles: patch.roles, status: before.status };
      if (wouldLockOut(next, candidates.filter((one) => one.id !== before.id), roleMatrix())) {
        return lockoutRefusal({ userId: before.id, roles: patch.roles });
      }
    }

    const after: MockUser = {
      ...before,
      name: patch.name?.trim() || before.name,
      roles: patch.roles ?? before.roles,
      grants: grantsFromRoles(patch.roles ?? before.roles),
    };
    state.users[index] = after;

    recordBy(auth, 'user.update', 'consoleUser', after.id, {
      before: { name: before.name, roles: before.roles },
      after: { name: after.name, roles: after.roles },
    });

    return HttpResponse.json(toAdminUser(after));
  }),

  ...(['suspend', 'reactivate'] as const).map((verb) =>
    http.post(`*/admin/users/:id/${verb}`, async ({ request, params }) => {
      await delay(LATENCY_MS);
      const auth = authorize(request, 'usersAndRoles', 'write');
      if ('response' in auth) return auth.response;

      const index = state.users.findIndex((one) => one.id === params.id);
      if (index < 0) return fail({ status: 404, code: '404', message: 'No such user.' });

      const before = state.users[index]!;
      const { reason } = (await request.json()) as { reason?: string };

      // A suspended colleague will ask why, exactly as a suspended supplier does (§12.1).
      if (!reason || reason.trim().length < 10) {
        return fail({ status: 422, code: 'note-required', message: 'A reason is required.' });
      }

      if (verb === 'suspend') {
        if (before.id === auth.user.id) {
          return fail({
            status: 409,
            code: 'self-modification',
            message: 'You cannot suspend your own account.',
            details: { what: 'suspend' },
          });
        }
        const candidates: LockoutCandidate[] = state.users.map((one) => ({
          id: one.id,
          roles: one.roles,
          status: one.status,
        }));
        const next = { id: before.id, roles: before.roles, status: 'suspended' as const };
        if (wouldLockOut(next, candidates.filter((one) => one.id !== before.id), roleMatrix())) {
          return lockoutRefusal({ userId: before.id });
        }
      }

      const after: MockUser = {
        ...before,
        status: verb === 'suspend' ? 'suspended' : 'active',
      };
      state.users[index] = after;

      recordBy(auth, `user.${verb}`, 'consoleUser', after.id, {
        before: { status: before.status },
        after: { status: after.status, reason: reason.trim() },
      });

      return HttpResponse.json(toAdminUser(after));
    }),
  ),

  /**
   * Clear an enrolled second factor.
   *
   * The one action in this module that is a security operation rather than an administrative
   * one: it is what the office does when somebody loses their phone, and it is exactly what
   * an attacker holding an administrator session would do. Hence the reason, the audit entry,
   * and the refusal on yourself — resetting your own is not recovery, it is dropping your
   * second factor while holding a live session.
   */
  http.post('*/admin/users/:id/mfa/reset', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'usersAndRoles', 'write');
    if ('response' in auth) return auth.response;

    const index = state.users.findIndex((one) => one.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such user.' });

    const before = state.users[index]!;
    const { reason } = (await request.json()) as { reason?: string };
    if (!reason || reason.trim().length < 10) {
      return fail({ status: 422, code: 'note-required', message: 'A reason is required.' });
    }
    if (before.id === auth.user.id) {
      return fail({
        status: 409,
        code: 'self-modification',
        message: 'You cannot reset your own second factor.',
        details: { what: 'mfa' },
      });
    }

    const after: MockUser = { ...before, mfaEnrolled: false };
    state.users[index] = after;

    recordBy(auth, 'user.mfa.reset', 'consoleUser', after.id, {
      before: { mfaEnrolled: before.mfaEnrolled },
      after: { mfaEnrolled: false, reason: reason.trim() },
    });

    return HttpResponse.json(toAdminUser(after));
  }),

  /* ── M14 Configuration ─────────────────────────────────────────────────── */

  /**
   * The authenticated config, **and** what a change to it would cost.
   *
   * **Registered before the public `/config` handler, and it has to be.** That handler's
   * path is a wildcard followed by `/config`, and MSW's wildcard matches across segments —
   * so it swallows `/admin/config` and answers it with the unauthenticated payload. Placed
   * after it, this endpoint returned `404 tenant-unknown` for every request, which is
   * exactly the class of bug the "specific routes first" note at the top of this file
   * exists for. Caught by the M14 suite, not by reading.
   */
  http.get('*/admin/config', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'flagsAndBranding');
    if ('response' in auth) return auth.response;

    return HttpResponse.json({ config: tenantConfig(request), usage: configUsage() });
  }),

  /**
   * Save one or more sections.
   *
   * **AC-12 lives here**: white-label.md says a new factory is a DNS record and a
   * `client_config` row, so if a field is missing from this handler the criterion is false.
   * The refusals are what stop the row being edited into a state that hides records:
   */
  http.patch('*/admin/config', async ({ request }) => {
    await delay(LATENCY_MS);
    // `write` — §12.1 gives `flagsAndBranding: W` to the factory admin and the platform
    // admin, and `R` to the manager. A manager may read the configuration and not change it.
    const auth = authorize(request, 'flagsAndBranding', 'write');
    if ('response' in auth) return auth.response;

    const patch = (await request.json()) as ConfigPatch & { tenantId?: string };

    /**
     * The tenant is not editable.
     *
     * It is resolved from the subdomain (`config/tenant.ts`) and everything else is keyed
     * on it, so an editable copy would be a second source of truth for the one value that
     * decides which factory's records are being served.
     */
    if (patch.tenantId !== undefined) {
      return fail({
        status: 409,
        code: 'tenant-immutable',
        message: 'The factory id comes from the subdomain and cannot be edited.',
      });
    }

    const config = tenantConfig(request);
    const usage = configUsage();
    const impacts = configImpact(
      patch,
      {
        flags: config.flags,
        collectionPoints: config.collectionPoints,
        banks: config.banks,
        contentLanguages: config.localization.contentLanguages,
      },
      usage,
    );

    /**
     * Refused with the **impacts in `details`**, not a bare code.
     *
     * A factory administrator told "that is not allowed" opens a support ticket; one told
     * "9 suppliers hold LKR 412,000 in savings" goes and looks at the savings screen. The
     * console renders these from the same keys, so the two can never disagree.
     */
    if (!isConfigPatchAllowed(impacts)) {
      const blocking = impacts.filter((impact) => impact.severity === 'blocks');
      const first = blocking[0]!;
      const code = first.field.startsWith('collectionPoints')
        ? 'point-in-use'
        : first.messageKey.includes('fallbackLanguage')
          ? 'fallback-language-required'
          : first.field === 'payouts.export'
            ? 'export-template-invalid'
            : 'flag-has-records';
      return fail({
        status: code === 'fallback-language-required' ? 422 : 409,
        code,
        message: 'That change would hide records the factory still has to account for.',
        details: { impacts: blocking },
      });
    }

    if (!patch.factory?.name && patch.factory && 'name' in patch.factory) {
      return fail({ status: 422, code: 'invalid', message: 'The factory needs a name.' });
    }

    // Section by section, so a patch that names one block never blanks another. The
    // sections that are lists are replaced wholesale — a merged bank list would keep
    // branches the factory has just removed, which is the bug `configRepository.merge`
    // documents on the read side.
    const before = JSON.parse(JSON.stringify(config)) as RuntimeConfig;
    if (patch.factory) config.factory = { ...config.factory, ...patch.factory };
    if (patch.flags) config.flags = { ...config.flags, ...patch.flags };
    if (patch.savings) config.savings = patch.savings;
    if (patch.banks) config.banks = patch.banks.map((bank) => ({ ...bank, branches: [...bank.branches] }));
    if (patch.localization) config.localization = { ...config.localization, ...patch.localization };
    if (patch.branding) config.branding = { ...config.branding, ...patch.branding };
    if (patch.theme) {
      config.theme = {
        ...config.theme,
        colors: { ...config.theme?.colors, ...patch.theme.colors },
      };
    }
    if (patch.push) {
      config.push = {
        topicPrefix: patch.push.topicPrefix ?? config.push?.topicPrefix ?? tenantOf(request),
        categories: (patch.push.categories ?? config.push?.categories ?? []) as NotificationCategory[],
        defaultCategories: (patch.push.defaultCategories ??
          config.push?.defaultCategories ??
          []) as NotificationCategory[],
      };
    }
    if (patch.manureProducts) config.manureProducts = patch.manureProducts.map((one) => ({ ...one }));
    if (patch.payouts) {
      // Replaced wholesale, not merged: the column list *is* the value, and merging two
      // column arrays would produce an order nobody chose.
      config.payouts = {
        export: {
          ...patch.payouts.export,
          columns: patch.payouts.export.columns.map((column) => ({ ...column })),
        },
      };
    }
    if (patch.collectionPoints) config.collectionPoints = patch.collectionPoints.map((p) => ({ ...p }));

    /**
     * Audited **per section**, with only the sections that changed in before/after.
     *
     * A config row is large, and an entry carrying the whole thing on every save is an
     * entry nobody reads — which defeats the point of AC-09 for the one record whose edits
     * reach across every other module.
     */
    state.configRevisions[config.tenantId] = (state.configRevisions[config.tenantId] ?? 1) + 1;

    const sections = Object.keys(patch);
    recordBy(auth, 'config.update', 'config', tenantOf(request), {
      before: Object.fromEntries(
        sections.map((key) => [key, (before as unknown as Record<string, unknown>)[key]]),
      ),
      after: Object.fromEntries(
        sections.map((key) => [key, (config as unknown as Record<string, unknown>)[key]]),
      ),
    });

    return HttpResponse.json({ config, usage: configUsage() });
  }),

  /* ── Tenant config: public, per subdomain ──────────────────────────────── */
  http.get('*/config', async ({ request }) => {
    await delay(LATENCY_MS);
    if (!mockConfigs[tenantOf(request)]) {
      return fail({ status: 404, code: 'tenant-unknown', message: 'No such factory.' });
    }

    /**
     * Served from **live state**, not from the seed.
     *
     * This is what closes the loop AC-12 is about: M14 edits the `client_config` row, and
     * every consumer of it — the sidebar's flags, the theme, the collection-point pickers,
     * M11's content languages, M13's push categories — reads it from here. Serving the
     * fixture instead would make the configuration screen a form that saves into nothing,
     * which is the most convincing way to appear to satisfy the criterion without doing so.
     *
     * The `ETag` carries a revision, so a config that has been edited is not answered from
     * a `304` against the version before the edit.
     */
    const config = tenantConfig(request);
    state.configRevisions[config.tenantId] = state.configRevisions[config.tenantId] ?? 1;
    return HttpResponse.json(config, {
      headers: { ETag: `"cfg-${config.tenantId}-${state.configRevisions[config.tenantId]}"` },
    });
  }),

  /* ── Auth ──────────────────────────────────────────────────────────────── */
  http.post('*/admin/auth/login', async ({ request }) => {
    await delay(LATENCY_MS * 2); // login is deliberately the slowest call
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

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

    const user = state.users.find((u) => u.id === userId)!;
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
    const user = userId ? state.users.find((u) => u.id === userId) : undefined;
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
      // §21.9: what each supplier has asked back and not yet been paid. Re-read on every
      // generation, so a withdrawal recorded after a draft run appears when it is re-run.
      // §21.10: the factory's approved rates, and each supplier's chosen repayment period.
      deductionRates: activeDeductionRates(),
      repaymentMonths: new Map(
        state.suppliers.map((supplier) => [
          supplier.id,
          Object.fromEntries(
            (['advance', 'loan', 'manure'] as const)
              .map((facility) => {
                // The plan is priced off what was **borrowed**, so the instalment is fixed
                // and the debt actually clears — see `creditInstalment`.
                const approved = state.creditRequests.find(
                  (one) =>
                    one.supplierId === supplier.id &&
                    one.facility === facility &&
                    one.status === 'approved' &&
                    one.repaymentMonths,
                );
                return [
                  facility,
                  approved ? { amount: approved.amount, months: approved.repaymentMonths! } : null,
                ];
              })
              .filter(([, plan]) => plan),
          ),
        ]),
      ),
      savingsWithdrawals: new Map(
        state.suppliers.map((supplier) => [
          supplier.id,
          pendingWithdrawalTotal(pendingWithdrawalsFor(supplier.id)),
        ]),
      ),
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
    // And the other direction (§21.9): withdrawals this month's accounts paid out.
    settleWithdrawalsFor(monthKey, publishedAt);

    /**
     * M13, if this factory has the trigger on.
     *
     * Fired **here**, from the module that owns the event, rather than by something
     * watching the audit log: publishing is the moment a bill becomes something a
     * supplier can open, so it is the moment the notification means anything. It cannot
     * throw and cannot block — a push that failed must never roll back an irreversible
     * publish, and `fireAutomatic` records the outcome in the send log instead.
     */
    fireAutomatic(request, 'billPublished', {
      title: `Your ${monthKey} account is ready`,
      body: 'The Green Leaf Account has been published. Open the app to see your kilos and your balance.',
      entity: 'monthlyRate',
      entityId: monthKey,
    });

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

  /* ── §21.10 deduction rates ─────────────────────────────────────────────── */

  /**
   * What the factory charges, and what is waiting for a second person.
   *
   * `customised: false` means this factory is still running on the figures the console
   * shipped with — which are the mock's old invented ones. Said out loud rather than
   * presented as the factory's own decision, because a transport charge nobody chose is
   * still on every account.
   */
  http.get('*/admin/deduction-rates', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose');
    if ('response' in auth) return auth.response;

    return HttpResponse.json({
      rates: activeDeductionRates(),
      customised: state.deductionRates !== null,
      pending: state.deductionRateChanges.find((one) => one.status === 'pending') ?? null,
      history: state.deductionRateChanges
        .filter((one) => one.status !== 'pending')
        .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))
        .slice(0, 10),
    });
  }),

  /**
   * Propose a change. `ratesAndMonthClose: write` — the accountant's.
   *
   * Nothing takes effect here, which is the answer to §21.10's "does it need a second
   * person?". Transport at LKR 2.50/kg against LKR 4.50/kg is a different sum on every
   * account in the factory and nobody would notice for a month, so it is proposed and
   * approved exactly like M4's monthly rate.
   */
  http.post('*/admin/deduction-rates', async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose', 'write');
    if ('response' in auth) return auth.response;

    const { rates, reason } = (await request.json()) as {
      rates?: DeductionRates;
      reason?: string;
    };

    if (!reason || reason.trim().length < 10) {
      return fail({
        status: 422,
        code: 'note-required',
        message: 'A reason is required — the approver has to know what changed and why.',
      });
    }
    if (!rates) {
      return fail({ status: 422, code: 'invalid', message: 'No rates were sent.' });
    }

    const problems = deductionRateProblems(rates);
    if (problems.length > 0) {
      return fail({
        status: 422,
        code: 'invalid-rates',
        message: 'Those rates could not be applied to an account.',
        details: { problems },
      });
    }

    // One at a time: two pending proposals would mean an approver deciding one set of
    // figures while a second waited to overwrite them.
    if (state.deductionRateChanges.some((one) => one.status === 'pending')) {
      return fail({
        status: 409,
        code: 'change-pending',
        message: 'A rate change is already waiting for approval.',
      });
    }

    const change: DeductionRateChange = {
      id: `drc-${nextId()}`,
      status: 'pending',
      proposed: rates,
      // Frozen at proposal time, so the diff the approver reads cannot drift under them.
      current: activeDeductionRates(),
      reason: reason.trim(),
      proposedAt: new Date().toISOString(),
      proposedById: auth.user.id,
      proposedByName: auth.user.name,
      decidedAt: null,
      decidedByName: null,
      decisionNote: null,
    };
    state.deductionRateChanges.push(change);

    recordBy(auth, 'deductionRates.propose', 'deductionRates', change.id, {
      before: change.current,
      after: { rates, reason: change.reason },
    });

    return HttpResponse.json(change, { status: 201 });
  }),

  /** Approve or reject one. `ratesAndMonthClose: approve` — the manager's (§12.1). */
  http.post('*/admin/deduction-rates/:id/:verb', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorize(request, 'ratesAndMonthClose', 'approve');
    if ('response' in auth) return auth.response;

    const verb = String(params.verb);
    if (verb !== 'approve' && verb !== 'reject') {
      return fail({ status: 404, code: '404', message: 'No such action.' });
    }

    const index = state.deductionRateChanges.findIndex((one) => one.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such rate change.' });

    const change = state.deductionRateChanges[index]!;
    if (change.status !== 'pending') {
      return fail({
        status: 409,
        code: 'already-decided',
        message: 'That rate change has already been decided.',
        details: { status: change.status, decidedByName: change.decidedByName },
      });
    }

    /**
     * BR-501, and it is reachable here because `approve` implies `write`: a manager
     * *could* propose a rate and then approve it, and this is what stops them. The same
     * check M4 makes on publishing a month whose rate you entered.
     */
    if (verb === 'approve' && change.proposedById === auth.user.id) {
      return fail({
        status: 409,
        code: 'four-eyes-violation',
        message: 'The person who proposed a rate change cannot approve it.',
        details: { proposedByName: change.proposedByName },
      });
    }

    const { note } = (await request.json().catch(() => ({}))) as { note?: string };
    if (verb === 'reject' && (!note || note.trim().length < 10)) {
      return fail({ status: 422, code: 'note-required', message: 'A reason is required.' });
    }

    state.deductionRateChanges[index] = {
      ...change,
      status: verb === 'approve' ? 'approved' : 'rejected',
      decidedAt: new Date().toISOString(),
      decidedByName: auth.user.name,
      decisionNote: note?.trim() ?? null,
    };

    /**
     * Approved rates apply to the **next generation**, not retrospectively.
     *
     * A published month is the record (BR-108), and a rate change that silently re-priced
     * accounts a supplier is already holding would be the worst kind of correction. An open
     * month picks them up the next time its bills are run, which is what re-generation is
     * for.
     */
    if (verb === 'approve') state.deductionRates = change.proposed;

    recordBy(auth, `deductionRates.${verb}`, 'deductionRates', change.id, {
      before: change.current,
      after: verb === 'approve' ? change.proposed : { rejected: true, note: note?.trim() },
    });

    return HttpResponse.json(state.deductionRateChanges[index]);
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
   * The run as a file (§21.17). Registered before `/payout-runs/:id`.
   *
   * **Three things make this a server act rather than a console one**, and each is the
   * reason it is not simply the on-screen grid written to a `Blob`:
   *
   *  1. **The account numbers are real.** Every other payload in this API masks them
   *     (§20.4) — a payment file cannot. So producing one joins to the full numbers, which
   *     is a thing only the server may do.
   *  2. **It is therefore audited**, with the run, the line count and the total. A file of
   *     two hundred account numbers left an office; that is an event, not a page view.
   *  3. **The layout is the tenant's**, and the tenant's row is here. The console renders a
   *     preview from the same shared `serialisePayoutFile`, so what is previewed and what
   *     is downloaded cannot drift.
   *
   * Only **payable** lines: a held line has nowhere to pay to and a paid one has already
   * been paid, so both in a file to the bank would be a double payment or a rejection.
   */
  http.get('*/admin/payout-runs/:id/file', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enablePayouts');
    if (gated) return gated;
    const auth = authorize(request, 'payouts');
    if ('response' in auth) return auth.response;

    const run = state.payoutRuns.find((candidate) => candidate.id === params.id);
    if (!run) return fail({ status: 404, code: '404', message: 'No such payout run.' });

    /**
     * A draft cannot be downloaded, and this is the refusal that matters here.
     *
     * The four-eyes rule (BR-501) exists so that no one person can move money alone. A file
     * generated from an unapproved run and uploaded to the bank walks straight around it —
     * the approval step would be reduced to a formality performed after the payment.
     */
    if (run.status === 'draft') {
      return fail({
        status: 409,
        code: 'run-not-approved',
        message: 'A run has to be approved before it can be paid.',
        details: { status: run.status },
      });
    }

    const template = tenantConfig(request).payouts?.export ?? DEFAULT_PAYOUT_EXPORT;
    const problems = payoutTemplateProblems(template);
    if (problems.length > 0) {
      // Refused rather than served malformed: a file the bank rejects costs a re-send, and
      // the fix is on a screen this message can name.
      return fail({
        status: 409,
        code: 'export-template-invalid',
        message: 'The payout file layout is not usable.',
        details: { problems },
      });
    }

    const payable = linesOf(run.id).filter((line) => line.status === 'pending');
    const rows: PayoutExportLine[] = payable.map((line) => ({
      supplierCode: line.supplierCode,
      supplierName: line.supplierName,
      // The **full** number, joined here and nowhere else in the API.
      accountNumber: mockFullAccountNumbers.get(line.supplierId) ?? null,
      bankName: line.bankName,
      branchName: line.branchName,
      amount: line.amount,
      monthKey: run.monthKey,
      method: run.method,
    }));

    recordBy(auth, 'payout.run.export', 'payoutRun', run.id, {
      after: {
        monthKey: run.monthKey,
        method: run.method,
        lines: rows.length,
        total: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
      },
    });

    const filename = payoutFileName(run.monthKey, run.method, template.delimiter);
    return new HttpResponse(serialisePayoutFile(rows, template), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
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
   * The scheme's rules, and what this supplier may ask for right now (§21.9).
   *
   * Served rather than derived on the client, because the *window* depends on the factory's
   * Colombo-local month and the *available* figure depends on requests the console has not
   * necessarily fetched. One answer, so the screen and the refusal agree.
   */
  http.get('*/admin/savings/accounts/:supplierId/withdrawals', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enableSavings');
    if (gated) return gated;
    const auth = authorize(request, 'billing');
    if ('response' in auth) return auth.response;

    const supplier = state.suppliers.find((candidate) => candidate.id === params.supplierId);
    if (!supplier) return fail({ status: 404, code: '404', message: 'No such supplier.' });

    const policy = savingsPolicyOf(request);
    const pending = pendingWithdrawalsFor(supplier.id);
    const pendingTotal = pendingWithdrawalTotal(pending);

    return HttpResponse.json({
      policy,
      windowOpen: isWithdrawalWindowOpen(policy, new Date()),
      balance: supplier.savingsBalance,
      pendingTotal,
      available: availableToWithdraw(supplier.savingsBalance, pendingTotal),
      // Newest first: the office is looking at what was asked for most recently.
      items: state.savingsWithdrawals
        .filter((one) => one.supplierId === supplier.id)
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    });
  }),

  /**
   * Ask for savings back.
   *
   * **Nothing moves here.** The balance does not change and no ledger entry is written: the
   * factory's answer to §21.9 is that a withdrawal is paid on the next Green Leaf Account,
   * so this records an intention and M5 turns it into a line. The passbook moves when that
   * account is published, which keeps one rule — *the ledger is derived from published
   * bills* — rather than two.
   */
  http.post('*/admin/savings/accounts/:supplierId/withdrawals', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enableSavings');
    if (gated) return gated;
    // `billing: write` — §12.1 calls the capability "Bills & savings", and the accountant
    // holds it. A clerk may read a passbook and not move what is in it.
    const auth = authorize(request, 'billing', 'write');
    if ('response' in auth) return auth.response;

    const supplier = state.suppliers.find((candidate) => candidate.id === params.supplierId);
    if (!supplier) return fail({ status: 404, code: '404', message: 'No such supplier.' });

    const { amount, reason } = (await request.json()) as { amount?: number; reason?: string };

    /**
     * A reason, like every other movement of somebody else's money in this console.
     *
     * The supplier will ask why their passbook dropped, months later, and "withdrawal" with
     * no sentence beside it is a conversation nobody in the office can have — the same
     * argument AC-06 makes about a rejection note.
     */
    if (!reason || reason.trim().length < 10) {
      return fail({
        status: 422,
        code: 'note-required',
        message: 'A reason is required to record a withdrawal.',
      });
    }

    const policy = savingsPolicyOf(request);
    const pendingTotal = pendingWithdrawalTotal(pendingWithdrawalsFor(supplier.id));
    const problems = withdrawalProblems({
      amount: Number(amount),
      balance: supplier.savingsBalance,
      pendingTotal,
      policy,
      now: new Date(),
    });

    if (problems.length > 0) {
      // The first problem names the code, so the screen says *which* rule stopped it —
      // "the window is shut until April" and "that is more than is held" are different
      // conversations and a single `invalid` would flatten them into one.
      const first = problems[0]!;
      return fail({
        status: first === 'window-closed' ? 409 : 422,
        code: first,
        message: 'That withdrawal cannot be recorded.',
        details: {
          problems,
          withdrawalMonth: policy.withdrawalMonth,
          available: availableToWithdraw(supplier.savingsBalance, pendingTotal),
        },
      });
    }

    const now = new Date();
    const record_: SavingsWithdrawal = {
      id: `wd-${nextId()}`,
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.name,
      amount: round2(Number(amount)),
      status: 'pending',
      requestedMonth: colomboMonthKey(now),
      requestedAt: now.toISOString(),
      requestedByName: auth.user.name,
      reason: reason.trim(),
      settledBillId: null,
      settledMonthKey: null,
    };
    state.savingsWithdrawals.push(record_);

    recordBy(auth, 'savings.withdrawal.request', 'supplier', supplier.id, {
      after: { amount: record_.amount, reason: record_.reason, month: record_.requestedMonth },
    });

    return HttpResponse.json(record_, { status: 201 });
  }),

  /**
   * Cancel one that has not been paid yet.
   *
   * Cancelled rather than deleted — a request the office recorded and then withdrew is a
   * thing that happened, and a supplier who was told "it is arranged" and then finds no
   * payment will ask. Same rule that voids a delivery rather than removing it.
   */
  http.post('*/admin/savings/withdrawals/:id/cancel', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gated = featureGate(request, 'enableSavings');
    if (gated) return gated;
    const auth = authorize(request, 'billing', 'write');
    if ('response' in auth) return auth.response;

    const index = state.savingsWithdrawals.findIndex((one) => one.id === params.id);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such withdrawal.' });

    const existing = state.savingsWithdrawals[index]!;
    if (existing.status !== 'pending') {
      return fail({
        status: 409,
        code: 'already-settled',
        message: 'That withdrawal has already been paid.',
        details: { status: existing.status, billId: existing.settledBillId },
      });
    }

    const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!reason || reason.trim().length < 10) {
      return fail({ status: 422, code: 'note-required', message: 'A reason is required.' });
    }

    state.savingsWithdrawals[index] = { ...existing, status: 'cancelled' };
    recordBy(auth, 'savings.withdrawal.cancel', 'supplier', existing.supplierId, {
      before: { amount: existing.amount, status: 'pending' },
      after: { status: 'cancelled', reason: reason.trim() },
    });

    return HttpResponse.json(state.savingsWithdrawals[index]);
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

      /**
       * `requestDecided`, to the one supplier who asked.
       *
       * The **decision note is deliberately not in the push**, even though it is the most
       * useful sentence the office wrote. It is written *to* the supplier and can say why
       * a bank change was refused; a lock screen is read by whoever is holding the phone,
       * and this is the one category that carries a decision about somebody's money.
       */
      fireAutomatic(
        request,
        'requestDecided',
        {
          title: status === 'approved' ? 'Your request was approved' : 'Your request was not approved',
          body: 'Open the app to see the decision and the note from the office.',
          entity: 'changeRequest',
          entityId: before.id,
        },
        { kind: 'supplier', supplierId: before.supplierId },
      );

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

  /* ── M13 Notifications ─────────────────────────────────────────────────── */

  /** Registered before the collection route so the literal segment wins. */
  http.get('*/admin/notifications/triggers', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enablePushNotifications');
    if (gate) return gate;
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const push = pushConfigOf(request);
    return HttpResponse.json(
      state.notificationTriggers.map((trigger) => ({
        ...trigger,
        event: NOTIFICATION_EVENTS[trigger.category],
        // `false` when the tenant carries no push config at all, or does not list this
        // category — so the console says "not configured for this factory" instead of
        // offering a toggle that would answer `category-disabled`.
        available: Boolean(push?.categories.includes(trigger.category)),
      })),
    );
  }),

  /**
   * Turn a trigger on or off.
   *
   * **This endpoint is the answer to §21.24**, deferred rather than guessed: whether the
   * office composes every send or whether "your bill is ready" fires off the publish step
   * is a row here, not a code change.
   */
  http.put('*/admin/notifications/triggers/:category', async ({ request, params }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enablePushNotifications');
    if (gate) return gate;
    // `content: approve` — the same boundary M11 draws. Deciding that every supplier's
    // phone buzzes when a month closes is a factory-administrator decision, not an
    // editor's.
    const auth = authorize(request, 'content', 'approve');
    if ('response' in auth) return auth.response;

    const category = String(params.category);
    const check = checkSendable(request, category);
    if ('response' in check) return check.response;

    const index = state.notificationTriggers.findIndex((one) => one.category === category);
    if (index < 0) return fail({ status: 404, code: '404', message: 'No such trigger.' });

    const { enabled } = (await request.json()) as { enabled?: boolean };
    const before = state.notificationTriggers[index]!;
    const after = {
      ...before,
      enabled: Boolean(enabled),
      updatedAt: new Date().toISOString(),
      updatedByName: auth.user.name,
    };
    state.notificationTriggers[index] = after;

    recordBy(auth, 'notification.trigger.set', 'notificationTrigger', category, {
      before: { enabled: before.enabled },
      after: { enabled: after.enabled },
    });

    return HttpResponse.json({
      ...after,
      event: NOTIFICATION_EVENTS[after.category],
      available: true,
    });
  }),

  /**
   * How far a send would reach — **before** anybody presses send.
   *
   * A `POST` despite being a read: the audience is a structured body, and encoding a
   * supplier id into a cacheable URL for a preview is worse than the verb mismatch.
   */
  http.post('*/admin/notifications/reach', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enablePushNotifications');
    if (gate) return gate;
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as {
      category?: string;
      audience?: NotificationAudience;
    };
    const check = checkSendable(request, String(body.category));
    if ('response' in check) return check.response;

    return HttpResponse.json(
      resolveReach(
        request,
        body.category as NotificationCategory,
        body.audience ?? { kind: 'allSuppliers' },
      ),
    );
  }),

  http.get('*/admin/notifications', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enablePushNotifications');
    if (gate) return gate;
    const auth = authorize(request, 'content');
    if ('response' in auth) return auth.response;

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const origin = url.searchParams.get('origin');

    let rows = state.notificationSends;
    if (category) rows = rows.filter((send) => send.category === category);
    if (origin) rows = rows.filter((send) => send.origin === origin);

    // Newest first: a send log is read from the top, and the message somebody is asking
    // about is almost always the one that just went out.
    rows = sortRows(rows, url, (a, b) => b.createdAt.localeCompare(a.createdAt));

    return HttpResponse.json(paginate(rows, url));
  }),

  /**
   * Send one, composed by a person.
   *
   * `content: approve`, which is the console's answer to §21.24's second half — "who may
   * send free text". A composed push reaches every supplier's lock screen and **cannot be
   * recalled**, which is a different act from writing an article somebody else publishes.
   * Stated on the screen so the factory can contest it.
   */
  http.post('*/admin/notifications', async ({ request }) => {
    await delay(LATENCY_MS);
    const gate = featureGate(request, 'enablePushNotifications');
    if (gate) return gate;
    const auth = authorize(request, 'content', 'approve');
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as {
      category?: string;
      title?: string;
      body?: string;
      audience?: NotificationAudience;
    };

    const check = checkSendable(request, String(body.category));
    if ('response' in check) return check.response;

    const title = body.title?.trim() ?? '';
    const text = body.body?.trim() ?? '';
    if (title.length === 0 || text.length === 0) {
      return fail({ status: 422, code: 'invalid', message: 'A title and a message are required.' });
    }
    if (title.length > MAX_PUSH_TITLE_CHARS || text.length > MAX_PUSH_BODY_CHARS) {
      return fail({
        status: 422,
        code: 'invalid',
        message: 'That is longer than a lock screen will show.',
      });
    }

    const category = body.category as NotificationCategory;
    const audience = body.audience ?? { kind: 'allSuppliers' };
    const reach = resolveReach(request, category, audience);

    /**
     * Nobody would receive it — refused rather than logged as sent.
     *
     * Unlike an automatic send, somebody is standing at this screen: telling them the
     * message went nowhere is information they can act on (put it on the noticeboard,
     * or turn the category back on), while a green row in the log is a lie they will
     * believe.
     */
    if (reach.reachableDevices === 0) {
      return fail({
        status: 409,
        code: 'no-recipients',
        message: 'No device in that audience accepts this category.',
        details: {
          targetedSuppliers: reach.targetedSuppliers,
          suppressedDevices: reach.suppressedDevices,
          suppliersWithoutDevice: reach.suppliersWithoutDevice,
        },
      });
    }

    const now = new Date().toISOString();
    const send: NotificationSend = {
      id: `ntf-${nextId()}`,
      category,
      origin: 'composed',
      title,
      body: text,
      audience,
      entity: null,
      entityId: null,
      targetedSuppliers: reach.targetedSuppliers,
      reachableDevices: reach.reachableDevices,
      suppressedDevices: reach.suppressedDevices,
      status: 'sent',
      createdById: auth.user.id,
      createdByName: auth.user.name,
      createdAt: now,
      sentAt: now,
      failureReason: null,
    };
    state.notificationSends = [send, ...state.notificationSends];

    recordBy(auth, 'notification.send', 'notification', send.id, {
      after: {
        category,
        audience,
        title,
        reachableDevices: reach.reachableDevices,
        suppressedDevices: reach.suppressedDevices,
      },
    });

    return HttpResponse.json(send, { status: 201 });
  }),

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

      /**
       * Only on `publish`, and only the fallback title.
       *
       * A push carries one string, so it carries the language everything falls back to
       * (AC-08) — the alternative is choosing a language per device, which the app does
       * itself when it opens the article. Taking a supplier to copy they can read is the
       * app's job; getting them there is this one's.
       */
      if (verb === 'publish') {
        const headline = after.translations[EDITORIAL_FALLBACK_LANGUAGE];
        if (headline) {
          fireAutomatic(request, 'newsArticle', {
            title: headline.title,
            body: headline.excerpt ?? headline.body.slice(0, MAX_PUSH_BODY_CHARS),
            entity: 'newsArticle',
            entityId: after.id,
          });
        }
      }

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

    /**
     * Aimed at **one supplier**, which is what makes this the safest of the four
     * triggers: the audience is the person who asked, and the body carries no answer —
     * only that there is one. A reply can name a bank account or a dispute, and a lock
     * screen is read by whoever is holding the phone.
     */
    fireAutomatic(
      request,
      'inquiryReplied',
      {
        title: 'The factory replied to your message',
        body: `Your message about "${before.subject}" has an answer.`,
        entity: 'inquiry',
        entityId: before.id,
      },
      { kind: 'supplier', supplierId: before.supplierId },
    );

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
   * The content and notification state too, and **`cloneNews` rather than a spread**:
   * a shallow copy shares the `translations` map with the seed, so a test that saves a
   * Sinhala translation mutates the fixture and every later test finds Sinhala already
   * written — the AC-08 gap it was asserting on quietly gone.
   *
   * The triggers matter for the same reason from the other direction: a test that turns
   * `newsArticle` on leaves every subsequent publish firing a notification, and a suite
   * asserting "no send was made" fails somewhere else entirely.
   */
  state.news = mockNews.map(cloneNews);
  state.staticPages = mockStaticPages.map(cloneStaticPage);
  state.users = mockUsers.map((user) => ({ ...user, roles: [...user.roles] }));
  state.savingsWithdrawals = [];
  state.deductionRates = null;
  state.deductionRateChanges = [];
  state.roleMatrix = null;
  state.roleMatrixUpdatedAt = null;
  state.roleMatrixUpdatedByName = null;
  state.configs = {};
  state.configRevisions = {};
  state.notificationTriggers = mockNotificationTriggers.map((trigger) => ({ ...trigger }));
  state.notificationSends = mockNotificationSends.map((send) => ({ ...send }));
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
