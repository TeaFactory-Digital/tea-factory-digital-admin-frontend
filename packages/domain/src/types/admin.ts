/**
 * Console-only types: the office's half of every flow the app can only ask for.
 *
 * These do not exist in the mobile bundle, but they live in this package anyway
 * because the **API** implements them and the API shares this package. A console
 * type invented in `apps/admin` is a DTO the backend can drift from.
 */

import type {
  BankDetails,
  ChangeRequest,
  CreditFacility,
  NotificationCategory,
  PaymentMethod,
  RequestStatus,
  Supplier,
} from './app';
import type { LanguageCode, RequestChannel } from '../constants';

/* ─────────────────────────────── Identity ─────────────────────────────── */

/**
 * Console roles (§12). A **separate auth realm** from suppliers: different
 * table, different token audience, different login screen. A supplier token
 * must never open the console.
 */
export type ConsoleRole =
  | 'clerk'
  | 'weigher'
  | 'accountant'
  | 'manager'
  | 'editor'
  | 'factoryAdmin'
  | 'platformAdmin';

/** One row of the §12.1 permission matrix. */
export type Capability =
  | 'suppliers'
  | 'deliveries'
  | 'ratesAndMonthClose'
  | 'billing'
  | 'payouts'
  | 'creditRequests'
  | 'creditAboveThreshold'
  | 'changeRequests'
  | 'inquiries'
  | 'content'
  | 'flagsAndBranding'
  | 'usersAndRoles'
  | 'reports'
  | 'auditLog'
  | 'tenants';

/** `R` read · `W` create/edit · `A` approve/reject · `—` no access. */
export type AccessLevel = 'none' | 'read' | 'write' | 'approve';

/** A console user. Roles are **per factory**; only a platform admin spans tenants. */
export interface ConsoleUser {
  id: string;
  name: string;
  email: string;
  /** The tenant this identity belongs to. `null` for a platform admin. */
  factoryId: string | null;
  roles: ConsoleRole[];
  /** Mandatory for manager and above (admin-console.md → Auth and roles). */
  mfaEnrolled: boolean;
  lastLoginAt: string | null;
  status: 'active' | 'suspended';
}

/**
 * What the server says this session may do.
 *
 * Sent explicitly rather than derived from `roles` on the client, because
 * "roles are data, not code" (§12.1) — a factory will want to split or merge
 * roles, and that must not be a console deploy. The client-side matrix in
 * `rbac.ts` is the offline default for when the server sends nothing.
 */
export type CapabilityGrants = Partial<Record<Capability, AccessLevel>>;

/** The result of a completed sign-in. */
export interface AuthSession {
  /** Short-lived (15 min). Held in memory only — never localStorage. */
  accessToken: string;
  /** ISO timestamp the access token expires. */
  expiresAt: string;
  user: ConsoleUser;
  grants: CapabilityGrants;
}

/** Sign-in that has not finished: MFA is still owed. */
export interface MfaChallenge {
  /** Opaque, single-use, short-lived. Not a session token. */
  challengeToken: string;
  method: 'totp';
  /** Present only during first-time enrolment. */
  enrolment?: { secret: string; otpauthUrl: string };
}

export type LoginResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'mfaRequired'; challenge: MfaChallenge };

/* ─────────────────────────────── Paging ─────────────────────────────── */

/**
 * The list envelope, following the news feed's existing shape (§17.5):
 * zero-based `page`, a `pageSize`, and an explicit `nextPage`.
 *
 * `total` is added for the console because a data grid shows "1–50 of 2,431"
 * and a queue badge needs a count without walking the pages.
 */
export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  nextPage: number | null;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  /** `asc` | `desc`. */
  dir?: 'asc' | 'desc';
}

/* ─────────────────────────────── M2 Suppliers ─────────────────────────────── */

export type SupplierStatus = 'active' | 'suspended' | 'closed';

/**
 * A supplier as the office sees them: the app's `Supplier` plus the registry
 * facts the supplier's own phone never shows.
 *
 * `bankDetails` is **masked by the server** (§20.4) and the full number is a
 * separate, audited call — see `POST /admin/suppliers/{id}/bank-details/reveal`.
 * A payload that carried the real number and expected the console to hide it
 * would not be a security control.
 */
export interface AdminSupplier extends Supplier {
  status: SupplierStatus;
  /** NIC — a search key in the office, never shown to other suppliers. */
  nic: string;
  /** Division / weighing point this supplier delivers to. */
  collectionPoint: string;
  registeredAt: string;
  /** ISO date of the most recent leaf delivery, or null if never. */
  lastDeliveryAt: string | null;
  /** Masked for display, e.g. "•••• 4821". Never the full number. */
  bankDetails?: BankDetails;
  /** True when the office holds bank details at all — M4 blocks close without them. */
  hasBankDetails: boolean;
  savingsBalance: number;
  creditBalances: Record<CreditFacility, number>;
  /** Open request counts, so the detail page can link straight into a queue. */
  pendingRequests: number;
  suspendedReason?: string;
}

/** The grid row. Deliberately smaller than the detail — thousands are listed. */
export interface SupplierListItem {
  id: string;
  supplierCode: string;
  name: string;
  nic: string;
  collectionPoint: string;
  status: SupplierStatus;
  paymentMethod: PaymentMethod;
  savingsPerKg: number;
  hasBankDetails: boolean;
  lastDeliveryAt: string | null;
  pendingRequests: number;
}

export interface SupplierQuery extends PageQuery {
  /** Matches supplier code, name or NIC. Tolerates the division suffix. */
  q?: string;
  status?: SupplierStatus;
  collectionPoint?: string;
  /** Registered but not supplying — feeds the dormant-suppliers report (§19.2). */
  dormantMonths?: number;
}

/** What the office may edit directly, without a supplier-side change request. */
export interface SupplierEditable {
  name: string;
  nic: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  homeAddress?: string;
  estateAddress?: string;
  collectionPoint: string;
}

export interface SupplierRegistration extends SupplierEditable {
  supplierCode: string;
  paymentMethod: PaymentMethod;
  savingsPerKg: number;
}

/** The full number, returned once, and the reveal is audited (§20.4). */
export interface RevealedBankDetails {
  bankName: string;
  branchName: string;
  accountNumber: string;
  /** The audit entry this reveal produced, so the UI can prove it was recorded. */
  auditId: string;
}

/* ───────────────────────── M3 Leaf collection ───────────────────────── */

/** How a delivery row reached the office. */
export type DeliverySource = 'manual' | 'scaleFile';

/**
 * One weighing: a supplier, a day, a figure in kilos.
 *
 * The **fact** the whole money side is derived from (api.md §16): a bill is a read
 * model over these rows and a monthly rate, so a wrong figure here is a wrong
 * bill, a wrong payout and a wrong savings deduction. That is why it is voided
 * rather than deleted, and why `recordedBy` is on the row itself.
 */
export interface Delivery {
  id: string;
  /** Colombo-local calendar day, `YYYY-MM-DD` (BR-104). */
  date: string;
  /** Derived from `date`, so a month's rows can be found without date maths. */
  monthKey: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  /** Where it was **weighed** — not necessarily the supplier's registered point. */
  collectionPoint: string;
  kgs: number;
  source: DeliverySource;
  /** The commit this row arrived in, so a whole weighing session can be found. */
  batchId: string;
  recordedById: string;
  recordedByName: string;
  recordedAt: string;
  /**
   * Voided rather than deleted (§12.1): nothing money-bearing is ever removed,
   * and a delivery that was entered and withdrawn is something the office may
   * have to explain. `null` while the row stands.
   */
  voidedAt: string | null;
  voidedByName: string | null;
  voidedReason: string | null;
}

export interface DeliveryQuery extends PageQuery {
  /** One Colombo-local day. The entry screen's primary filter. */
  date?: string;
  from?: string;
  to?: string;
  collectionPoint?: string;
  supplierId?: string;
  /** Voided rows are evidence, not data: hidden unless asked for. */
  includeVoided?: boolean;
}

/** One row of a weighing session, as the grid commits it. */
export interface DeliveryDraft {
  supplierId: string;
  kgs: number;
}

/**
 * A whole weighing session, committed in one call.
 *
 * `batchId` is generated by the console when the session starts and travels as
 * the `Idempotency-Key`. That is what makes a re-sent commit safe: a clerk whose
 * connection dropped mid-request clicks again, and the server must answer with the
 * original result rather than recording sixty deliveries twice.
 */
export interface DeliveryBatch {
  date: string;
  collectionPoint: string;
  batchId: string;
  rows: DeliveryDraft[];
}

/**
 * Why one row of a batch was refused while the rest committed.
 *
 * `index` is the row's position in the submitted array, because that is the only
 * thing the grid can map back to a line the clerk is looking at.
 */
export interface DeliveryRejection {
  index: number;
  supplierId: string;
  /** `supplier-unknown` · `supplier-inactive` · `invalid-kg`, or a new one. */
  code: string;
  message: string;
}

/**
 * The result of a commit: what was recorded, what was refused, and the day's
 * totals afterwards.
 *
 * **Partial acceptance is deliberate.** All-or-nothing would mean one unknown
 * supplier code sends sixty good rows back to the clerk to re-enter, and the
 * grid's whole promise is that a weighing session survives one bad line.
 */
export interface DeliveryBatchResult {
  accepted: Delivery[];
  rejected: DeliveryRejection[];
  /** So the running totals are the server's, not the console's, after a commit. */
  day: CollectionDaySummary;
}

/**
 * A day's leaf at one collection point, or across all of them when
 * `collectionPoint` is `null`.
 *
 * `locked` is the M3 half of BR-108: a published month is immutable, so the
 * screen must know before it offers an entry grid that the server will refuse.
 */
export interface CollectionDaySummary {
  date: string;
  collectionPoint: string | null;
  monthKey: string;
  totalKgs: number;
  supplierCount: number;
  deliveryCount: number;
  /** The §13 stage of the month this day belongs to. */
  monthStage: MonthCycleStage;
  locked: boolean;
}

/* ───────────────────────── M9 Change requests ───────────────────────── */

/** An attachment the office added as evidence for a decision. */
export interface Attachment {
  id: string;
  filename: string
  contentType: string;
  sizeBytes: number;
  url: string;
  uploadedAt: string;
  uploadedByName: string;
}

/** Who decided, when, and why — the note is rendered back to the supplier. */
export interface Decision {
  /** Never optional: rejecting without a note is impossible (AC-06). */
  note: string;
  decidedById: string;
  decidedByName: string;
  decidedAt: string;
}

/**
 * A change request as the queue shows it: the app's record plus who it belongs
 * to and everything needed to decide without opening another screen.
 */
export interface AdminChangeRequest extends ChangeRequest {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  /** Where it came from — `office` when a clerk raised it for the supplier. */
  channel: RequestChannel;
  /** Set on the creating actor so four-eyes can be enforced (BR-501). */
  createdById: string | null;
  createdByName: string | null;
  decision: Decision | null;
  attachments: Attachment[];
  /** Hours the request has been waiting — drives queue-age colouring. */
  ageHours: number;
}

export interface ChangeRequestQuery extends PageQuery {
  status?: RequestStatus;
  type?: ChangeRequest['type'];
  supplierId?: string;
  q?: string;
}

/** Body for approve and reject alike. `note` is mandatory on both (AC-06). */
export interface DecisionBody {
  note: string;
  attachmentIds?: string[];
}

/* ───────────────────────────── M1 Dashboard ───────────────────────────── */

/** Which queue a count belongs to. One per module that has an inbox. */
export type QueueKey =
  | 'changeRequests'
  | 'advanceRequests'
  | 'loanRequests'
  | 'manureRequests'
  | 'inquiries';

export interface QueueCount {
  queue: QueueKey;
  pending: number;
  /** ISO timestamp of the oldest pending item, or null when the queue is empty. */
  oldestPendingAt: string | null;
  /** Items older than the §14.4 service-level target. */
  breachingSla: number;
}

/**
 * Where the month is (§13). The console's most-asked question, because it
 * decides what every other module will let you do.
 */
export type MonthCycleStage =
  | 'collecting'
  | 'awaitingRate'
  | 'rateEntered'
  | 'billsGenerated'
  | 'published';

export interface MonthCycleStatus {
  monthKey: string;
  stage: MonthCycleStage;
  /** Unresolved M4 exceptions. A month cannot publish while any remain (AC-04). */
  openExceptions: number;
  ratePerKg: number | null;
  extraRatePerKg: number | null;
  publishedAt: string | null;
  publishedByName: string | null;
}

export interface TodaysCollection {
  /** Colombo-local date (BR-104). */
  date: string;
  totalKgs: number;
  supplierCount: number;
  deliveryCount: number;
  /** Same figures for the previous day, so the number has something to mean. */
  previousDayKgs: number;
}

export type AlertSeverity = 'info' | 'warning' | 'error';

/**
 * Something the office should look at. Server-composed, because the rule that
 * makes it an alert is policy — a console that invented its own thresholds
 * would disagree with the reports.
 */
export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  /** i18n key, not a sentence — the console localizes (BR-110). */
  messageKey: string;
  /** Values interpolated into `messageKey`. */
  params?: Record<string, string | number>;
  /** In-console route this alert is about. */
  href?: string;
}

export interface DashboardSummary {
  queues: QueueCount[];
  cycle: MonthCycleStatus;
  today: TodaysCollection;
  alerts: DashboardAlert[];
  /** Last 14 Colombo-local days of intake, oldest first (charts read left→right). */
  intakeTrend: Array<{ date: string; totalKgs: number }>;
}

/* ──────────────────── M4 Rates & month close ──────────────────── */

/**
 * The auction result for a month, as the office enters it.
 *
 * Two figures rather than one because the factory pays two: the rate derived from
 * the auction, and an `extra` it adds at its own discretion. The app shows the sum
 * and the bill itemizes both, so collapsing them here would lose a number the
 * supplier is entitled to see.
 *
 * `enteredBy` is on the record, not in a side table, because it is half of the
 * four-eyes rule: the person who entered a rate may not be the one who publishes
 * the month it belongs to (BR-501).
 */
export interface MonthlyRate {
  monthKey: string;
  /** LKR per kilo, from the auction. */
  ratePerKg: number;
  /** LKR per kilo the factory adds on top. `0` is a real answer, not "unset". */
  extraRatePerKg: number;
  enteredById: string;
  enteredByName: string;
  enteredAt: string;
}

/** What the office is being asked to enter. `monthKey` travels in the path. */
export interface MonthlyRateEntry {
  ratePerKg: number;
  extraRatePerKg: number;
}

/**
 * Why a month cannot close yet.
 *
 * A **first-class record**, not a count (api-contract.md §9): AC-04 requires the
 * accountant to resolve each one, which means each needs an id, a type, and a link
 * to the record it is about. A number on a dashboard cannot be worked through.
 */
export type MonthExceptionType =
  /** Leaf delivered, nowhere to pay it — blocks the payout run (AC-04). */
  | 'missingBankDetails'
  /** Leaf recorded against a supplier who is suspended or closed. */
  | 'inactiveSupplierWithLeaf'
  /** A change request still open, whose outcome would change this month's bill. */
  | 'pendingChangeRequest'
  /** A weighing far outside the day's spread — `1250` typed for `125.0`. */
  | 'outlierDelivery';

export interface MonthException {
  id: string;
  monthKey: string;
  type: MonthExceptionType;
  /** The record to go and fix, so the row can link straight to it. */
  entity: 'supplier' | 'delivery' | 'changeRequest';
  entityId: string;
  supplierCode: string | null;
  supplierName: string | null;
  /**
   * English-only detail, treated as a fallback (§17.4). The console renders from
   * `type` so the copy is localized; this carries the specifics, like the kilos.
   */
  detail: string;
  raisedAt: string;
  /**
   * Resolved, never deleted. "Who decided this was acceptable, and why" is the
   * question an auditor asks about a month that closed with exceptions on it.
   */
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
}

export interface MonthExceptionQuery extends PageQuery {
  /** Omit for everything; `false` is the accountant's working list. */
  resolved?: boolean;
}

/**
 * A month, with everything the close screen decides from.
 *
 * Extends the dashboard's cycle status rather than restating it: the badge on the
 * dashboard and the stage on this screen must never be two different answers.
 */
export interface MonthSummary extends MonthCycleStatus {
  rate: MonthlyRate | null;
  totalKgs: number;
  supplierCount: number;
  deliveryCount: number;
  /** Resolved and unresolved together, so the screen can show "3 of 11 left". */
  totalExceptions: number;
  /** `false` once published (BR-108) — the same flag M3 reads before offering entry. */
  open: boolean;
}

/* ───────────────────────────── M17 Audit log ───────────────────────────── */

/**
 * Append-only, never updated or deleted (BR-502). Every approve, reject, rate
 * change, publish and payout lands here within one second, with actor and
 * before/after (AC-09).
 */
export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  /** Dotted verb, e.g. `changeRequest.approve`, `supplier.bankDetails.reveal`. */
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip: string | null;
}

export interface AuditQuery extends PageQuery {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
}

/* ──────────────────────── Runtime tenant config ──────────────────────── */

/**
 * The payload that makes the console white-label at **runtime**.
 *
 * This is the same `GET /config` the app calls (white-label.md → Config as an
 * API) with a console-facing addition: web asset URLs, because the console
 * cannot bundle a per-tenant logo the way a per-brand binary can.
 */
export interface RuntimeConfig {
  /** Tenant id resolved from the subdomain, echoed back for verification. */
  tenantId: string;
  factory: {
    name: string;
    telephone: string;
    regNo: string;
    location: string;
    supportEmail?: string;
    supportHours?: string;
    /** Legal footer text — per client today (status.md §21.19). */
    legalFooter?: string;
  };
  /** Same flags the app reads, so turning off manure empties the office queue too. */
  flags: FeatureFlagSet;
  savings: { perKgOptions: number[] };
  banks: Array<{ name: string; branches: string[] }>;
  localization: {
    defaultLanguage: LanguageCode;
    supportedLanguages: LanguageCode[];
    /** Languages *editorial content* must be authored in. */
    contentLanguages: LanguageCode[];
  };
  /** Colour/radius overrides, merged over the bundled base tokens. */
  theme?: ThemeOverridePayload;
  branding: {
    /** Absolute URL. Optional: `<Logo>` falls back to a themed wordmark. */
    logoUrl?: string;
    logoDarkUrl?: string;
    faviconUrl?: string;
  };
  push?: {
    topicPrefix: string;
    categories: NotificationCategory[];
    defaultCategories: NotificationCategory[];
  };
  /** Collection points / divisions this factory weighs at. */
  collectionPoints: Array<{ id: string; name: string }>;
}

/**
 * Serialisable theme override. Deliberately *not* `ThemeOverride` from
 * `@tfd/brand`: this one crosses the wire, so it may only contain JSON.
 */
export interface ThemeOverridePayload {
  colors?: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  radius?: Record<string, number>;
  spacing?: Record<string, number>;
}

/**
 * Feature flags, identical to the app's set (white-label.md → Feature flags).
 *
 * The console reads the same values, so a factory that does not lend against
 * income history has no loan queue *and* no loan screen. A flag that only hides
 * a screen is a UI preference, not a policy — the API must refuse the call too,
 * with `403 feature-disabled` (AC-07).
 */
export interface FeatureFlagSet {
  enableSavings: boolean;
  enableAdvances: boolean;
  enableLoans: boolean;
  enableManure: boolean;
  enableInquiry: boolean;
  enableNews: boolean;
  enablePushNotifications: boolean;
  enablePromoBanner: boolean;
  /** Console-side surfaces that not every factory buys. */
  enablePayouts: boolean;
  enableReports: boolean;
}

export type FeatureFlagName = keyof FeatureFlagSet;

/* ─────────────────────────── Error envelope ─────────────────────────── */

/**
 * The wire error shape (§17.4). `code` is what the UI branches on; `message` is
 * English-only and treated as a fallback.
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Console-specific error codes, on top of the app's domain codes.
 *
 * `four-eyes-violation` and `stale-eligibility` are the two that must exist:
 * the console has to be *refused*, not merely warned, when it tries to approve
 * its own record (BR-501) or act on eligibility that has moved since the queue
 * was rendered (BR-310).
 */
export const ADMIN_ERROR_CODES = [
  'feature-disabled',
  'forbidden',
  'four-eyes-violation',
  'stale-eligibility',
  'note-required',
  'month-locked',
  'mfa-required',
  'mfa-invalid',
  'supplier-code-taken',
  'already-decided',

  /* M3 Leaf collection. */
  'batch-too-large',
  'already-voided',
  /** Raised by the console's own guard before a bad session leaves the browser. */
  'invalid-batch',

  /* M4 Rates & month close. */
  'invalid-rate',
  'rate-missing',
  'exceptions-open',
  'already-resolved',
  'already-published',
  'month-mismatch',
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];
