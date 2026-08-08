/**
 * Console-only types: the office's half of every flow the app can only ask for.
 *
 * These do not exist in the mobile bundle, but they live in this package anyway
 * because the **API** implements them and the API shares this package. A console
 * type invented in `apps/admin` is a DTO the backend can drift from.
 */

import type {
  BankDetails,
  BannerAction,
  ChangeRequest,
  CreditFacility,
  GreenLeafBill,
  Inquiry,
  NotificationCategory,
  PaymentMethod,
  RequestStatus,
  SavingsLedgerEntry,
  Supplier,
  TeaPacketDeliveryMethod,
} from './app';
import type {
  ContentStatus,
  InquiryStatus,
  NotificationOrigin,
  NotificationSendStatus,
  LanguageCode,
  RequestChannel,
  StaticPageSlug,
} from '../constants';
import type { ContentTranslation, ContentTranslations } from '../content';
import type { BannerTranslations } from '../banners';
import type { NotificationAudience } from '../notifications';
import type { PayoutExportTemplate } from '../payoutExport';
import type { ManureProduct } from '../deductionRates';
import type { TeaPacketPolicy } from '../teaPackets';

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
  /**
   * The supplier has a password the office issued and has not yet replaced (§21.16).
   *
   * **The app must force a change at first sign-in while this is true.** It is what makes
   * an office-issued credential one-time rather than one the office knows for ever — see
   * `supplierCredentials.ts`.
   */
  owesPasswordChange?: boolean;
  /** When the office last issued one, so a pattern of resets is visible on the record. */
  lastPasswordResetAt?: string | null;

  /**
   * Whether this supplier has ever signed in on a phone — **v2's first question about a
   * supplier**, and the one v1 had no field for.
   *
   * The registry is the factory's own console's in v2; what is left here is the *app
   * account*. So the record answers the questions app support actually asks: have they
   * got it, do they still have a device registered for notifications, and do they owe a
   * password change from a reset the office did at the counter.
   *
   * Derived from the device registry rather than stored, for the same reason
   * `isLastAdministrator` is: it stops being true the moment somebody uninstalls.
   */
  hasApp: boolean;
  /** Registered push devices. `0` with `hasApp: true` means they turned notifications off. */
  deviceCount: number;
  /** Most recent sign-in from the app, or `null` if never. */
  lastAppSignInAt: string | null;
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
  /** v2's app-account columns. See `AdminSupplier`. */
  hasApp: boolean;
  lastAppSignInAt: string | null;
}

export interface SupplierQuery extends PageQuery {
  /** Matches supplier code, name or NIC. Tolerates the division suffix. */
  q?: string;
  status?: SupplierStatus;
  collectionPoint?: string;
  /**
   * v2's working filter: who has not installed the app.
   *
   * The dashboard's adoption card links straight into it, which is the whole point of
   * putting filter state in the URL — a percentage nobody can turn into a list of names
   * is a percentage nobody acts on.
   */
  hasApp?: boolean;
  /**
   * Registered but not supplying — fed the dormant-suppliers report (§19.2).
   *
   * v2 keeps the field though the report is commented out: it is the factory's own
   * console's report, and the query parameter is what it was defined by.
   */
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

/* ───────────────────────── M7 Credit queues ───────────────────────── */

/**
 * The eligibility working behind one credit request.
 *
 * **Every intermediate figure is on the wire, not just the ceiling**, and that is
 * AC-05: the console must show the same numbers the supplier's app showed them,
 * byte for byte, including how they were reached. A payload carrying only
 * `ceiling: 48200` would let the approver and the applicant look at the same
 * limit and disagree about why — and "the app told me I could have more" is the
 * dispute this module exists to prevent.
 *
 * Derived by `buildCreditEligibility` in `leafCredit.ts`, which the API imports
 * rather than re-implements. Two implementations of a ceiling drift on the first
 * rounding decision.
 */
export interface CreditEligibility {
  facility: CreditFacility;
  /** The most the supplier may draw. **Truncated, never rounded** (`floor2`). */
  ceiling: number;
  /** Already drawn on this facility and not yet repaid. */
  outstanding: number;
  /** `ceiling − outstanding`, floored at zero. What a new request may reach. */
  available: number;
  eligible: boolean;
  /** i18n key naming the blocker, or `null` when eligible. Never a sentence. */
  reasonKey: string | null;

  /* The working, in the order the rule reads. */
  monthsOfHistory: number;
  requiredMonths: number;
  /** Gross income averaged over `requiredMonths`. `null` when the history is short. */
  averageMonthlyIncome: number | null;
  /** The loan multiple. `null` for the facilities not priced off income. */
  limitMultiplier: number | null;
  lastSettledMonthKey: string | null;
  /** The rate that priced the ceiling. `null` when no month has settled (BR-102). */
  lastSettledRatePerKg: number | null;
  /** The kilos the rate was multiplied by — this month's for an advance. */
  pricedKgs: number | null;

  /**
   * When the server derived this.
   *
   * Rendered next to the figures so an approver knows how fresh they are, and
   * carried into the audit entry — "approved against a ceiling computed at 09:12"
   * is the sentence that settles a dispute about a limit that has since moved.
   */
  computedAt: string;
}

/**
 * A credit request as the queue shows it.
 *
 * One type for all three facilities rather than three near-identical ones. They
 * differ in how the ceiling is priced and in nothing the queue does: the same
 * grid, the same four-eyes rule, the same note. `manureType` and `quantityKg` are
 * the only facility-specific fields, and they are `null` on the other two rather
 * than a discriminated union — a union would fork every consumer to read one
 * field.
 */
export interface AdminCreditRequest {
  id: string;
  facility: CreditFacility;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  /** LKR asked for. On manure this is the **value** of the fertilizer, not its weight. */
  amount: number;
  reason: string | null;
  /** Manure only; `null` on advance and loan. One of the factory's configured types. */
  manureType: string | null;
  quantityKg: number | null;
  /**
   * Accounts the supplier chose to repay over (§21.10).
   *
   * **Their decision, not the office's** — which is most of what §21.10 turned out to be.
   * `null` for a request raised before the app could ask, and those fall back to the
   * factory's share-of-gross cap alone. The approver sees it because it decides what comes
   * off every account until the balance is clear.
   */
  repaymentMonths: number | null;
  status: RequestStatus;
  createdAt: string;
  channel: RequestChannel;
  /** Set when the office raised it, so four-eyes can be enforced (BR-501). */
  createdById: string | null;
  createdByName: string | null;
  decision: Decision | null;
  /**
   * Re-derived at read time, never stored.
   *
   * A ceiling cached on the row is a ceiling that goes stale the moment a delivery
   * is recorded, and the approver would be reading a figure from whenever the
   * request happened to be written.
   */
  eligibility: CreditEligibility;
  /** Hours waiting — drives queue-age colouring against `QUEUE_SLA_HOURS`. */
  ageHours: number;
}

export interface CreditRequestQuery extends PageQuery {
  status?: RequestStatus;
  facility?: CreditFacility;
  supplierId?: string;
  q?: string;
  /** The requests asking for more than the supplier may have. The queue's hard cases. */
  overCeiling?: boolean;
}

/**
 * A credit decision. The note, plus the ceiling the approver was looking at.
 *
 * `ceilingSeen` is what makes BR-310 enforceable. Eligibility moves — a delivery
 * recorded this morning raises an advance ceiling, a month published lowers it —
 * and a queue rendered twenty minutes ago is a screen showing a limit that may no
 * longer exist. The server recomputes on approval and answers `stale-eligibility`
 * rather than lending against the figure it happens to hold now: **the approver
 * agreed to a specific number**, and silently substituting a different one is the
 * worst outcome available, because nobody finds out.
 */
export interface CreditDecisionBody extends DecisionBody {
  /** The `CreditEligibility.ceiling` on screen when the decision was made. */
  ceilingSeen: number;
}

/* ─────────────────────── M18 Tea packet requests ─────────────────────── */

/**
 * A tea-packet request as the queue works it.
 *
 * **A separate queue from M7, not a fourth facility.** The app has asked for these
 * since the first release (`RequestTeaPacketsScreen`) and v1 of this console had no
 * type, no queue and no flag for them — a request a supplier could raise and nobody
 * could decide, which is the exact failure M9 and M10 were built to end.
 *
 * They are not credit in the sense M7 means it: nothing prices a ceiling, so there
 * is no `CreditEligibility`, no `ceilingSeen` and no BR-310 staleness. What the
 * approver needs instead is the **store's** question — how many packets, and how do
 * they reach the supplier — plus the one figure that makes it a money decision at
 * all: what it will cost on the account.
 *
 * The value is recovered on the `deductions.tea` line of the next Green Leaf
 * Account, which is why `unitPrice` is on the row rather than looked up: the price
 * that was quoted when the request was decided is the price the supplier was told,
 * and a catalogue edit afterwards must not silently re-price a decided request.
 */
export interface AdminTeaPacketRequest {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  packets: number;
  deliveryMethod: TeaPacketDeliveryMethod;
  /** LKR per packet at the moment of the decision. Never re-read from the catalogue. */
  unitPrice: number;
  /** `packets × unitPrice`. On the wire rather than derived, for the same reason. */
  amount: number;
  /** The supplier's own note from the app. */
  notes: string | null;
  status: RequestStatus;
  createdAt: string;
  channel: RequestChannel;
  /** Set when the office raised it at the counter, so four-eyes can be enforced. */
  createdById: string | null;
  createdByName: string | null;
  decision: Decision | null;
  /**
   * The month whose published bill carried this on its `deductions.tea` line, or `null`
   * while the factory is still owed for it.
   *
   * On the row rather than inferred from dates, because "approved in July" and
   * "recovered on July's account" are different facts — a request approved after the
   * month closed is recovered on the next one, and the difference is what
   * `teaPacketsOutstanding` counts.
   */
  recoveredOnMonthKey: string | null;
  /** Hours waiting — drives queue-age colouring against `QUEUE_SLA_HOURS`. */
  ageHours: number;
}

export interface TeaPacketRequestQuery extends PageQuery {
  status?: RequestStatus;
  supplierId?: string;
  deliveryMethod?: TeaPacketDeliveryMethod;
  q?: string;
}

/* ───────────────────────── M10 Inquiries ───────────────────────── */

/** The office's answer, rendered back to the supplier in the app. */
export interface InquiryReply {
  body: string;
  repliedById: string;
  repliedByName: string;
  repliedAt: string;
}

/**
 * A supplier's message to the office, as the queue works it.
 *
 * **`status` is deliberately not the app's `RequestStatus`.** The app models an
 * inquiry with `pending | approved | rejected`, which is the vocabulary of a
 * request for something — and an inquiry is a question. "Approved" is not an
 * answer to "why was my July account short". `Omit`-ing the field and restating it
 * is the honest version of a mapping that has to exist somewhere; keeping the
 * app's word here would have spread it across every screen instead.
 *
 * `inquiryStatusForApp` converts, so the API has one implementation of the
 * mapping and the app keeps the field it already reads (status.md §21.18).
 */
export interface AdminInquiry extends Omit<Inquiry, 'status' | 'reply'> {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  status: InquiryStatus;
  channel: RequestChannel;
  /** Set when a clerk logged a walk-in or a telephone call on the supplier's behalf. */
  createdById: string | null;
  createdByName: string | null;
  reply: InquiryReply | null;
  /** Closed without an answer — a duplicate, or a message for somewhere else. */
  closedAt: string | null;
  closedByName: string | null;
  /** Why it was closed unanswered. Mandatory on close, `null` otherwise. */
  closureNote: string | null;
  ageHours: number;
}

export interface InquiryQuery extends PageQuery {
  status?: InquiryStatus;
  supplierId?: string;
  q?: string;
}

/** The answer the supplier reads. Minimum length enforced for the same reason a note's is. */
export interface InquiryReplyBody {
  body: string;
}

/** Closing unanswered takes a reason, because "closed" with no why is a lost message. */
export interface CloseInquiryBody {
  note: string;
}

/* ───────────────────────────── M1 Dashboard ───────────────────────────── */

/** Which queue a count belongs to. One per module that has an inbox. */
export type QueueKey =
  | 'changeRequests'
  | 'advanceRequests'
  | 'loanRequests'
  | 'manureRequests'
  | 'teaPacketRequests'
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

/**
 * How much of the factory's supplier base is actually on the app — **v2's headline
 * figure**, and the one this console is answerable for.
 *
 * v1's dashboard led with today's kilos, which is the right first number for a console
 * that runs the factory and the wrong one for a console that manages an app: the office
 * has a weighing system for kilos. What it has no other way to see is whether the thing
 * this project was built for is being used, and §19.3 calls app adoption and channel
 * shift *"the two KPIs that justify the project"*.
 *
 * Three counts rather than one percentage, because they are three different problems:
 * suppliers who have never installed it is a field-work problem, devices that have gone
 * quiet is a re-engagement problem, and a low request share is a trust problem.
 */
export interface AppAdoption {
  /** Suppliers with at least one signed-in device. */
  suppliersWithApp: number;
  totalSuppliers: number;
  /** Registered push devices — always ≥ `suppliersWithApp`; some people have two phones. */
  devicesRegistered: number;
  /**
   * Share of this month's requests raised in the app rather than at the counter, 0–1.
   *
   * `null` when no request has been raised at all this month (BR-102): a month with no
   * requests has no adoption share, and rendering `0%` would report a collapse that did
   * not happen.
   */
  appRequestShare: number | null;
}

/**
 * What is wrong with the content the app is showing — the second question v2's dashboard
 * exists to answer.
 *
 * Every figure here is a **silent** failure. A supplier reading a Sinhala article in
 * English, an FAQ page nobody has written, a banner whose window closed weeks ago: none
 * of them produce an error anywhere, and only a screen that goes looking will find them.
 * That is exactly the argument AC-08 makes about gaps being visible to the editor, one
 * level up.
 */
export interface ContentHealth {
  /** Published articles falling back for at least one language (AC-08). */
  articlesWithGaps: number;
  /** Published banners inside their live window right now. */
  bannersLive: number;
  /** Banners published whose window has closed — live in status, invisible in fact. */
  bannersExpired: number;
  /** Pages in `STATIC_PAGE_SLUGS` nobody has written; the app shows its bundled default. */
  staticPagesUnwritten: number;
}

export interface DashboardSummary {
  queues: QueueCount[];
  /** v2's lead figures. */
  app: AppAdoption;
  content: ContentHealth;
  /**
   * Twelve months of app-request share, oldest first (charts read left→right).
   *
   * The v2 replacement for `intakeTrend`, and monthly rather than daily on purpose:
   * adoption moves when the office hands out passwords at the counter, which is a
   * campaign, not a day's weather.
   */
  adoptionTrend: Array<{ monthKey: string; appShare: number | null }>;
  alerts: DashboardAlert[];

  /* ────────────────────────────────────────────────────────────────────────────
   * v1's factory-operations figures. **Still served, no longer rendered.**
   *
   * The cards that read them are commented out on `DashboardScreen`, not deleted, and
   * the fields stay on the payload for a reason worth stating: `cycle.stage` is what
   * decides whether the app shows a supplier an amount or a blank, so an office
   * answering the telephone about "why does my July account say nothing" still needs
   * it — and when that turns out to be true, uncommenting one card is the whole change.
   * ──────────────────────────────────────────────────────────────────────────── */
  cycle: MonthCycleStatus;
  today: TodaysCollection;
  /** Last 14 Colombo-local days of intake, oldest first. */
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

/* ────────────────────────────── M5 Bills ────────────────────────────── */

/**
 * A bill as the console shows it: the app's `GreenLeafBill`, plus what the office
 * needs and the supplier's phone never sees.
 *
 * It **extends** rather than restates, and that is AC-03: the console, the printed
 * slip and the app's Home screen must be the same figures field for field. A
 * console-shaped DTO alongside the app's would be two read models over one fact.
 */
export interface AdminBill extends GreenLeafBill {
  supplierId: string;
  /** The generation run this bill came out of, so a whole run can be found. */
  runId: string;
  generatedAt: string;
  generatedByName: string;
  /**
   * `null` until the month is published — which is the moment the supplier can
   * see it (BR-108). Before that a bill is the office's working figure.
   */
  publishedAt: string | null;
  /** Payable, but nowhere to pay it. A payout run holds these lines rather than dropping them. */
  hasBankDetails: boolean;
}

/**
 * The grid row. Deliberately far smaller than the slip: an accountant checking a
 * run reads down one column looking for the figure that is wrong, and a
 * hundred-supplier month is a hundred rows, not a hundred slips.
 */
export interface BillListItem {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  billNo: string;
  monthKey: string;
  totalKgs: number;
  /** `null` while the auction result is not in (BR-102) — never `0`. */
  grossAmount: number | null;
  deductionsTotal: number;
  finalBalance: number | null;
  paymentMethod: PaymentMethod;
  /** Deductions swallowed the account: nothing payable, and the shortfall carries. */
  carriesDebt: boolean;
  hasBankDetails: boolean;
  /**
   * BR-107: the itemized lines disagree with the stated total.
   *
   * Carried on the row rather than left for the console to work out, so the flag
   * means the same thing to every consumer — and so a bill that does not add up is
   * visible in the list instead of only on the slip nobody opened.
   */
  unbalanced: boolean;
}

/**
 * One generation run over a month.
 *
 * A bill is a read model (api.md §16), so generating is **recomputing**, not
 * writing a new fact — which is why re-running before the publish is normal rather
 * than exceptional. The run exists as a record because the accountant needs to
 * know *which* recomputation the figures on screen came from.
 */
export interface BillRun {
  runId: string;
  monthKey: string;
  generatedAt: string;
  generatedById: string;
  generatedByName: string;
  billCount: number;
  totalKgs: number;
  grossTotal: number;
  deductionsTotal: number;
  /** What a payout run would move, before any line is held. */
  payableTotal: number;
  savingsTotal: number;
  /** Bills with nothing to pay this month. */
  carryingDebt: number;
  /** Payable, with no account to pay into — the AC-04 blocker, seen again. */
  missingBankDetails: number;
  /**
   * The leaf has moved since this run.
   *
   * Derived by comparing the run's kilos with the month's live total, because a
   * delivery voided after generation leaves a bill that is quietly wrong. Before
   * the publish the fix is to re-run; after it, the month is immutable and there is
   * nothing to be stale against.
   */
  stale: boolean;
}

/**
 * A month as the money modules' pickers need it.
 *
 * Its own small endpoint rather than `GET /admin/months`, and the reason is the
 * §12.1 matrix: the month list is gated on `ratesAndMonthClose`, which the clerk does
 * not have — while `billing: R` gives them bills to read and therefore a month to
 * choose. Widening the close endpoint to let a picker work would grant read access to
 * the close itself, which is a permission decision made by accident.
 */
export interface BillMonth {
  monthKey: string;
  stage: MonthCycleStage;
  /** Bills generated for it. `0` when the run has not been made yet. */
  billCount: number;
  /** `false` once published (BR-108). */
  open: boolean;
}

export interface BillQuery extends PageQuery {
  monthKey?: string;
  /** Matches supplier code, name or bill number. */
  q?: string;
  /**
   * One supplier, across months — **the axis v1 did not have**.
   *
   * M5 was built month-first because it fed the month close and the payout run: pick a
   * month, then filter within it. That is the accountant's axis, and in v2 there is no
   * accountant on this screen — the module survives as supplier support, and supplier
   * support is by supplier. A clerk answering *"why is my July less than my June?"*
   * needs both months at once, and `monthKey` + `q` cannot express that.
   *
   * Note this is a filter on the **bills** list. The month-by-month summary the detail
   * page renders is `GET /admin/suppliers/{id}/income`, which is derived from the same
   * bills but shaped as a series rather than a page.
   */
  supplierId?: string;
  /** The bills a payout run cannot pay. */
  missingBankDetails?: boolean;
  /** The bills that pay nothing this month. */
  carriesDebt?: boolean;
}

/* ─────────────────── M2 · A supplier's own month history ─────────────────── */

/**
 * One month of a supplier's account, as the office sees it — **the same shape the app
 * shows the supplier** (`IncomeSummary` in `types/app.ts`).
 *
 * Deliberately the same type rather than a console-specific one. The whole reason this
 * exists is that a supplier telephones holding their phone, and the clerk has to be
 * looking at what the supplier is looking at. Two shapes for one screen's worth of facts
 * is how the two drift into disagreeing about a figure somebody is reading aloud.
 *
 * `grossAmount` and `finalBalance` are `null` until the month's auction result is in
 * (BR-102) — **never `0`**. The app renders that as a "pending" badge and so does the
 * console; a zero would tell a supplier they earned nothing.
 */
export interface SupplierMonthSummary {
  monthKey: string;
  /** The bill this month resolves to, so the row links straight to the slip. */
  billId: string | null;
  totalKgs: number;
  auctionResultAvailable: boolean;
  grossAmount: number | null;
  finalBalance: number | null;
}

/**
 * The history payload: which years have anything in them, and one year's months.
 *
 * `years` travels with the summaries for the same reason M16's month list travels with
 * its report catalogue — a picker fed from a second endpoint behind a different grant is
 * a picker that comes back empty for the one role that needs it.
 */
export interface SupplierIncomeHistory {
  supplierId: string;
  /** Descending — newest year first, which is what the picker should open on. */
  years: number[];
  /** The requested year, **oldest month first**: a chart reads left to right. */
  year: number;
  months: SupplierMonthSummary[];
}

/* ────────────── M2 · What this supplier can be notified about ────────────── */

/**
 * One registered device, as the office needs to see it.
 *
 * `RegisteredDevice` already exists in `types/app.ts` and carries the push token. This
 * omits it: a token is a credential, it appears in no other console payload (§20.4's
 * rule about account numbers is the same rule), and nothing in the office can do
 * anything with one.
 */
export interface SupplierDevice {
  id: string;
  platform: 'ios' | 'android';
  /** The categories **this device** accepts. Consent, not routing. */
  categories: NotificationCategory[];
  /**
   * When the device registered — **not when it was last seen**, which the platform does
   * not track. Named for what it is rather than approximated: "registered in March" and
   * "last opened the app in March" are different facts, and a clerk deciding whether a
   * supplier has abandoned the app would act on the second.
   */
  registeredAt: string;
}

/**
 * Why a category would or would not reach this supplier — **the answer to the most
 * common push support call there is.**
 *
 * *"I wasn't told my bill was ready."* There are four possible answers and v1 exposed
 * none of them per person: the console held the device registry, the consent lists, the
 * tenant's category list and the send log, and could only report them in aggregate
 * ("reaches 61 devices, 6 opted out") — which names nobody.
 *
 * So this is computed per category and says which of the four it is. `reachable` is the
 * conclusion; the three booleans under it are the working, in the order a clerk would
 * check them.
 */
export interface SupplierCategoryReach {
  category: NotificationCategory;
  /** The factory sends this category at all (`config.push.categories`). */
  offeredByFactory: boolean;
  /** At least one of this supplier's devices accepts it. */
  acceptedOnSomeDevice: boolean;
  /** Devices that accept it. `0` with `offeredByFactory: true` is an opt-out. */
  deviceCount: number;
  /** `offeredByFactory && acceptedOnSomeDevice`. The one-line answer. */
  reachable: boolean;
}

/**
 * Everything the office needs to answer "why didn't I get it?" for one supplier.
 *
 * `recentSends` is what turns a diagnosis into evidence: a category can be perfectly
 * reachable and the supplier still never told, because nothing was ever sent.
 */
export interface SupplierNotificationStatus {
  supplierId: string;
  /** `false` here makes every other field moot, and it is the commonest answer. */
  hasApp: boolean;
  devices: SupplierDevice[];
  categories: SupplierCategoryReach[];
  /**
   * Sends whose audience included this supplier, newest first.
   *
   * `deliveredToDevices` is what the server actually attempted for **this** supplier —
   * `0` on a send that reached hundreds is the case worth seeing, and an aggregate log
   * can never show it.
   */
  recentSends: Array<{
    id: string;
    category: NotificationCategory;
    title: string;
    sentAt: string;
    origin: NotificationOrigin;
    deliveredToDevices: number;
    suppressedReason: 'optedOut' | 'noDevice' | null;
  }>;
}

/* ───────────────────────────── M6 Payouts ───────────────────────────── */

/**
 * `draft` prepared and editable · `approved` signed off by a manager and payable ·
 * `completed` every line reconciled against what the bank or the counter did.
 *
 * There is no `cancelled`: a run that should not have existed is a run whose lines
 * are all marked failed with a reason, and that is a record rather than an absence.
 */
export type PayoutRunStatus = 'draft' | 'approved' | 'completed';

/**
 * `pending` payable and not yet paid · `held` payable but unpayable *by this
 * method* · `paid` · `failed`.
 *
 * `held` is the one that earns its place: a supplier with leaf and no bank details
 * must be **visible and counted**, not filtered out. A line silently dropped is a
 * supplier who is not paid and nobody notices until they telephone.
 */
export type PayoutLineStatus = 'pending' | 'held' | 'paid' | 'failed';

/**
 * A payout run: one month, one payment method.
 *
 * Split by method on purpose. A bank transfer file, a cheque list and a cash sheet
 * are three different physical things the office does, on three different days,
 * reconciled from three different pieces of paper — and one run covering all three
 * would show a total nobody in the office is responsible for.
 */
export interface PayoutRun {
  id: string;
  monthKey: string;
  method: PaymentMethod;
  status: PayoutRunStatus;
  lineCount: number;
  /** Lines this method can actually move. */
  payableCount: number;
  heldCount: number;
  paidCount: number;
  failedCount: number;
  /** The payable total. Held lines are excluded — they are not money going out. */
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  createdById: string;
  createdByName: string;
  approvedAt: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  /** Every line reconciled, or `null` while any remain. */
  completedAt: string | null;
}

/**
 * One supplier's payment inside a run.
 *
 * `amount` is copied from the **bill**, never re-derived. The bill is the record
 * the supplier holds (AC-03), and a payout that recomputed the figure would be a
 * second answer to a question that already has one.
 */
export interface PayoutLine {
  id: string;
  runId: string;
  /** The bill this pays. A payout line with no bill is a payment with no basis. */
  billId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  amount: number;
  method: PaymentMethod;
  /** Masked (§20.4). Revealing a number is M2's audited call, never a grid column. */
  bankName: string | null;
  branchName: string | null;
  accountNumber: string | null;
  status: PayoutLineStatus;
  /** Why it is held, or why the bank refused it. Mandatory on `failed`. */
  reason: string | null;
  paidAt: string | null;
  markedByName: string | null;
}

export interface PayoutRunQuery extends PageQuery {
  monthKey?: string;
  status?: PayoutRunStatus;
}

export interface PayoutLineQuery extends PageQuery {
  status?: PayoutLineStatus;
  q?: string;
}

/** Reconciliation against what actually happened. A failure needs a reason. */
export interface PayoutLineMark {
  status: 'paid' | 'failed';
  reason?: string;
}

/* ───────────────────────────── M8 Savings ───────────────────────────── */

/**
 * A supplier's savings account, as the office sees it.
 *
 * The balance is a **liability**, not factory income: this is the supplier's money,
 * deducted from their bill at their own approved rate and held. Which is why the
 * office is never offered a control that spends it here — see `SavingsSummary`.
 */
export interface SavingsAccount {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  /** The **active** rate (AC-01). A pending change shows as pending, never applied. */
  savingsPerKg: number;
  balance: number;
  lastContributionMonth: string | null;
  lastContributionAmount: number | null;
  /** An open savings-rate request, so the row can link straight into M9's queue. */
  pendingRateChangeId: string | null;
}

export interface SavingsAccountQuery extends PageQuery {
  q?: string;
  /** `true` for the accounts on `savingsPerKg: 0` — opted out, not absent. */
  optedOut?: boolean;
}

/**
 * Where a movement came from.
 *
 * `billDeduction` is the only one the console can produce today. `withdrawal` and
 * `interest` are in the vocabulary because the **ledger shape must not change**
 * when §21.9 is answered — whether a supplier may withdraw, on what notice, and
 * whether interest is paid is a policy question, and a ledger that has to grow a
 * column to answer it is a migration on money data.
 */
export type SavingsEntrySource =
  | 'openingBalance'
  | 'billDeduction'
  | 'adjustment'
  | 'withdrawal'
  | 'interest';

/**
 * One movement, extending the app's ledger row.
 *
 * **Oldest first** on the wire, which is part of the contract (types/app.ts): a
 * passbook is read forward, and a running `balance` only makes sense in the order
 * it accumulated.
 */
export interface AdminSavingsLedgerEntry extends SavingsLedgerEntry {
  id: string;
  supplierId: string;
  source: SavingsEntrySource;
  /** The bill the deduction came from, when it came from one. */
  billId: string | null;
  recordedAt: string;
  note: string | null;
}

/**
 * The scheme across the factory, for one month.
 *
 * `balanceTotal` leads because it is the question the office is actually asked —
 * "how much are we holding" — and because it is the figure an auditor reconciles
 * against the bank. The trend is oldest-first: charts read left to right.
 */
export interface SavingsSummary {
  monthKey: string;
  /** What the factory holds on suppliers' behalf. */
  balanceTotal: number;
  accountCount: number;
  /** On `savingsPerKg: 0` — a real answer, not a missing one. */
  optedOutCount: number;
  contributedThisMonth: number;
  contributingSuppliers: number;
  /** `null` when the month has no published bills to contribute from. */
  averagePerKg: number | null;
  trend: Array<{ monthKey: string; contributed: number; balanceTotal: number }>;
}

/* ─────────────── M11 News · M12 Static content ─────────────── */

/**
 * The **per-language gaps** on a content record, carried on the wire.
 *
 * Derived server-side rather than computed by each consumer, for the reason every
 * derived field in this file is: AC-08 says the gap must be visible to the editor, and a
 * console that worked it out itself would be the only thing that knew. The API renders
 * the same warning into a content report; the app decides a fallback from it.
 *
 * Both lists are **relative to the tenant's `contentLanguages`** — a factory that
 * authors in English and Tamil is not missing Sinhala, it never asked for it.
 */
export interface ContentGaps {
  /** Nothing written. The app falls back to `EDITORIAL_FALLBACK_LANGUAGE`. */
  missingLanguages: LanguageCode[];
  /** Written, but older than the fallback it was translated from. */
  staleLanguages: LanguageCode[];
}

/**
 * A news article as the office authors it: **every language at once**.
 *
 * The app's `NewsArticle` is a single-language projection of this — "localized
 * server-side by `lang`" (types/app.ts) — and that asymmetry is right. A supplier reads
 * one language; an editor is responsible for all of them, and cannot see a gap in a
 * shape that only ever holds one.
 */
export interface AdminNewsArticle extends ContentGaps {
  id: string;
  /** Stable link target. Derived from the fallback title, never from a translation. */
  slug: string;
  translations: ContentTranslations;
  coverImageUrl?: string;
  status: ContentStatus;
  publishedAt: string | null;
  publishedByName: string | null;
  createdAt: string;
  createdByName: string;
  /** The most recent edit in **any** language — see `ContentTranslation.updatedAt`. */
  updatedAt: string;
  updatedByName: string;
}

/**
 * The grid row.
 *
 * `title` is the **fallback** language's, deliberately: the office needs one column it
 * can scan, and a row whose title changed with the selected tab would make the list
 * unreadable while translating.
 */
export interface NewsListItem extends ContentGaps {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  updatedByName: string;
  hasCoverImage: boolean;
}

export interface NewsQuery extends PageQuery {
  status?: ContentStatus;
  /** Matches the title in any language — an editor searches in what they typed. */
  q?: string;
  /** `true` for the records AC-08 is about: published with a gap. */
  incomplete?: boolean;
}

/** One language's copy, as the editor saves it. `lang` travels in the path. */
export interface ContentTranslationBody {
  title: string;
  excerpt?: string;
  body: string;
}

/**
 * Creating an article.
 *
 * The fallback language's copy is **required at creation**, which is the same rule as
 * publishing seen earlier: a record with nothing to fall back to is a record that cannot
 * be shown to anybody, and creating one would only defer the error.
 */
export interface NewsArticleDraft {
  translations: Array<ContentTranslationBody & { lang: LanguageCode }>;
  coverImageUrl?: string;
}

/** What may be changed without touching copy. */
export interface NewsArticlePatch {
  coverImageUrl?: string | null;
}

/* ──────────────────── M11 Promo banners ──────────────────── */

/**
 * A promo banner as the office composes it: **every language at once**, plus the one
 * thing that is not copy — where the button goes.
 *
 * v1 had the flag (`enablePromoBanner`), the app type (`PromoBanner`) and no editor,
 * which is the worst of the three states available: a factory could turn the feature on
 * and then find there was no way to author anything for it. `banners.md` had the whole
 * specification and nothing implemented it.
 *
 * Shaped like `AdminNewsArticle` on purpose — same translation record, same gap lists,
 * same fallback rule — because an editor should not have to learn two content models.
 * The differences are the two things a banner has that an article does not: a **live
 * window**, and an **action** that must survive the app's allowlist (`banners.ts`).
 */
export interface AdminPromoBanner extends ContentGaps {
  id: string;
  translations: BannerTranslations;
  /** Full-width artwork. Optional — the app renders a branded panel without it. */
  imageUrl?: string;
  /** Width ÷ height, so the app reserves space before the image arrives. */
  imageAspectRatio?: number;
  /**
   * Where the button goes. **Not localized**: one destination in three languages, because
   * a banner whose Tamil button went somewhere else would be three banners.
   */
  action: BannerAction;
  startsAt: string;
  /** `null` means "until it is taken down". */
  endsAt: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  publishedByName: string | null;
  createdAt: string;
  createdByName: string;
  updatedAt: string;
  updatedByName: string;
}

/** The grid row. `title` is the fallback language's, as in `NewsListItem`. */
export interface BannerListItem extends ContentGaps {
  id: string;
  title: string;
  status: ContentStatus;
  /**
   * Where it is in its window, computed server-side against the same clock the app
   * reads. A console that worked this out from the browser's clock would disagree with
   * the phone on the day a banner starts.
   */
  window: 'scheduled' | 'live' | 'expired';
  startsAt: string;
  endsAt: string | null;
  hasImage: boolean;
  updatedAt: string;
  updatedByName: string;
}

export interface BannerQuery extends PageQuery {
  status?: ContentStatus;
  /** `live` is the office's most-asked question: what is in front of suppliers now? */
  window?: 'scheduled' | 'live' | 'expired';
  q?: string;
}

/** One language's banner copy, as the editor saves it. `lang` travels in the path. */
export interface BannerTranslationBody {
  title: string;
  /** The supporting line. Optional — plenty of banners are a headline and a button. */
  body?: string;
  buttonLabel: string;
}

/** Creating a banner. The fallback language's copy is required, as it is for an article. */
export interface BannerDraft {
  translations: Array<BannerTranslationBody & { lang: LanguageCode }>;
  imageUrl?: string;
  imageAspectRatio?: number;
  action: BannerAction;
  startsAt: string;
  endsAt: string | null;
}

/** What may be changed without touching copy. */
export interface BannerPatch {
  imageUrl?: string | null;
  imageAspectRatio?: number | null;
  action?: BannerAction;
  startsAt?: string;
  endsAt?: string | null;
}

/**
 * One of the app's fixed pages.
 *
 * No `archived`, no create and no delete, because the set is closed
 * (`STATIC_PAGE_SLUGS`): the app links to these slugs, so a page that could be removed
 * is a link to nowhere in a shipped binary.
 *
 * **`draft` here means "never published"**, not "has unpublished edits". A page the
 * factory has not written yet is one the app renders its bundled default for; once
 * published, an edit is live. That asymmetry with M11 is deliberate — a *new* article
 * must not appear half-written, while a correction to the FAQ that sat in a draft would
 * leave the wrong answer live for as long as nobody remembered to publish it. Every
 * edit is audited with before/after, so a bad one is traceable.
 */
export interface AdminStaticPage extends ContentGaps {
  slug: StaticPageSlug;
  translations: ContentTranslations;
  status: Extract<ContentStatus, 'draft' | 'published'>;
  publishedAt: string | null;
  publishedByName: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

/**
 * What a reader in one language actually gets — the console's preview of the app.
 *
 * Returned by its own endpoint rather than assembled in the console, so the preview is
 * the **server's** resolution. A preview the console composed would be a second
 * implementation of the fallback, and the editor would be signing off copy the app never
 * renders (AC-08).
 */
export interface ContentPreview {
  lang: LanguageCode;
  /** `null` when even the fallback is unwritten — nothing can be shown at all. */
  translation: ContentTranslation | null;
  /** True when the reader is being shown the fallback instead of their language. */
  usedFallback: boolean;
  fallbackLanguage: LanguageCode;
}

/* ───────────────────────── M13 Notifications ───────────────────────── */

/**
 * Whether this factory fires a category automatically, and off what.
 *
 * **This record is the answer to §21.24, deferred honestly.** The factory has not said
 * whether the office composes every send or whether "your bill is ready" fires off the
 * publish step — so both paths exist and *which triggers are on* is per-tenant data. When
 * the answer comes it is a row, not a rewrite.
 *
 * `event` is a fact rather than a policy: `billPublished` can only mean the moment a
 * month is published, because that is the moment a bill becomes something a supplier can
 * open. `enabled` is the policy.
 */
export interface NotificationTrigger {
  category: NotificationCategory;
  /** The console event it hangs off, e.g. `month.publish`. */
  event: string;
  enabled: boolean;
  /**
   * `false` when the tenant's `push.categories` does not include this one, so the
   * console can say "not configured for this factory" rather than offering a toggle
   * that would answer `category-disabled`. That is M14's job, not M13's.
   */
  available: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

/**
 * One send, as a **record** rather than a fire-and-forget.
 *
 * The counts are the reason it is a record. A push is the only thing this console does
 * that it gets no acknowledgement for — nothing comes back from a phone to say the
 * message was dropped — so "sent to 240" with no breakdown is a figure the office would
 * act on wrongly. `suppressedDevices` is the honest half: registered, subscribed, and
 * **opted out of this category** (api-contract.md §17). Counted, never quietly filtered.
 */
export interface NotificationSend {
  id: string;
  category: NotificationCategory;
  origin: NotificationOrigin;
  title: string;
  body: string;
  audience: NotificationAudience;
  /** For an automatic send, the record it fired from — so the log links back. */
  entity: string | null;
  entityId: string | null;
  /** Suppliers the audience resolved to. */
  targetedSuppliers: number;
  /** Devices that will receive it. */
  reachableDevices: number;
  /** Devices whose owner turned this category off. */
  suppressedDevices: number;
  status: NotificationSendStatus;
  /** `null` for an automatic send — nobody pressed anything. */
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  sentAt: string | null;
  /** Why it failed, when it did. */
  failureReason: string | null;
}

export interface NotificationQuery extends PageQuery {
  category?: NotificationCategory;
  origin?: NotificationOrigin;
}

/** What the office is about to send. `audience` decides who. */
export interface ComposeNotificationBody {
  category: NotificationCategory;
  title: string;
  body: string;
  audience: NotificationAudience;
}

/**
 * How far a send would actually reach, **before** anybody presses send.
 *
 * Its own endpoint because the numbers are the decision: a circular that reaches 40 of
 * 300 suppliers is a circular the office should put on the noticeboard instead, and there
 * is no way to learn that after the fact. `suppressed` is what makes the two figures
 * different and is the only place a factory ever sees its own opt-out rate.
 */
export interface NotificationReach {
  targetedSuppliers: number;
  reachableDevices: number;
  suppressedDevices: number;
  /** Suppliers in the audience with no registered device at all. */
  suppliersWithoutDevice: number;
}

/* ───────────────────────── M15 Users & roles ───────────────────────── */

/**
 * A console user as the administration screen lists them.
 *
 * Extends `ConsoleUser` with the two things a list has to show and a session payload has no
 * reason to carry: whether this person is **the way back into the console**, and whether they
 * owe a second factor.
 */
export interface AdminConsoleUser extends ConsoleUser {
  /**
   * Holds a role granting `usersAndRoles: write` and is active.
   *
   * Carried on the row so the console can withhold "suspend" from the last one without
   * recomputing the whole set per button — and so the count is the server's, since the
   * server is what refuses.
   */
  canAdministerUsers: boolean;
  /** Holds a manager-or-above role and has not enrolled a second factor. */
  owesMfa: boolean;
  /** `true` when suspending or demoting this user would lock the factory out. */
  isLastAdministrator: boolean;
}

export interface UserQuery extends PageQuery {
  q?: string;
  role?: ConsoleRole;
  status?: ConsoleUser['status'];
}

/** What the office may set when inviting somebody. */
export interface ConsoleUserDraft {
  name: string;
  email: string;
  roles: ConsoleRole[];
}

/** What the office may change afterwards. Email is not here — it is the identity. */
export interface ConsoleUserPatch {
  name?: string;
  roles?: ConsoleRole[];
}

/**
 * The §12.1 matrix, **as data on the wire**.
 *
 * rbac.md: *"a factory will want to split or merge these roles, and that must not be a
 * deploy."* This is that promise made operable — and `packages/domain/src/rbac.ts` becomes
 * what it always said it was, the offline default rather than the authority.
 */
export interface RoleMatrix {
  matrix: Record<ConsoleRole, Record<Capability, AccessLevel>>;
  /**
   * `true` when the served matrix differs from the shipped default, so the screen can say
   * "this factory has customised its roles" rather than leaving the reader to compare
   * fifteen rows against a table in a document.
   */
  customised: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

/* ───────────────────────────── M17 Audit log ───────────────────────────── */

/**
 * Append-only, never updated or deleted (BR-502). Every approve, reject, rate
 * change, publish and payout lands here within one second, with actor and
 * before/after (AC-09).
 */
/**
 * **Who** an audit entry is about.
 *
 * v1 had no such field, because every entry was written by somebody signed into this
 * console — so `actorId` implied `consoleUser` and nothing needed to say so.
 *
 * That stopped being true the moment the console became the app's management surface.
 * A supplier editing their own address through `PATCH /profile` is a real write to a
 * record the office is answerable for, and v1 recorded it **nowhere**: it was not a
 * change request (`ChangeRequestType` covers only payout and savings-rate changes), and
 * the audit log had no vocabulary for an actor who is not staff. The office could be
 * asked "when did this address change?" and had no way to answer.
 *
 * Three kinds rather than a boolean, because the third is a real and separate answer:
 * `system` is an automatic notification firing off a publish, and attributing that to a
 * person would be worse than leaving it blank.
 */
export type AuditActorType = 'consoleUser' | 'supplier' | 'system';

export interface AuditEntry {
  id: string;
  at: string;
  /**
   * The actor's id **in their own realm**. A console user id and a supplier id are
   * different namespaces — see `AuditActorType`, which is what says which one this is.
   */
  actorId: string;
  actorName: string;
  /**
   * Optional so an existing entry keeps working; treat an absent value as
   * `consoleUser`, which is what every v1 entry was.
   */
  actorType?: AuditActorType;
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
  /**
   * Filter to office actions or to what the supplier did themselves.
   *
   * The two answer different questions on the same record — *"what did we do to this
   * account"* and *"what did they do"* — and a clerk investigating a dispute is always
   * asking one of them rather than both.
   */
  actorType?: AuditActorType;
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
  /**
   * The savings scheme's own rules (§21.9), not just the rates a supplier may pick.
   *
   * `withdrawalMonth` and `annualInterestRate` are optional so an existing `client_config`
   * row keeps working — `DEFAULT_SAVINGS_POLICY` fills them, which is April and 0%.
   */
  savings: { perKgOptions: number[]; withdrawalMonth?: number; annualInterestRate?: number };
  /**
   * The fertilizer a supplier may ask for on credit, with its bag size and price (§21.10).
   *
   * Beside the banks and the collection points because it is a catalogue a supplier chooses
   * from, not a charge imposed on every account — see `ManureProduct`. The app's
   * `ManureRequest.manureType` names one of these, and its `quantityKg` prices against it.
   */
  manureProducts?: ManureProduct[];
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
  /**
   * What a packet of made tea is and what it costs (`enableTeaPackets`).
   *
   * Beside the manure catalogue for the same reason: it is a thing a supplier chooses
   * from the app, priced by a number that changes without a release. Optional so an
   * existing `client_config` row keeps working — `DEFAULT_TEA_PACKET_POLICY` fills it.
   */
  teaPackets?: TeaPacketPolicy;
  /**
   * How M6 writes a payout run out as a file — **§21.17 as configuration** rather than as
   * three guessed serialisers behind a dropdown. See `payoutExport.ts` for why the layout
   * is configured and the format's name is not.
   *
   * **v2: the factory's own console owns payouts**, so nothing in this console reads this
   * block any more. It stays on the payload rather than being dropped, because the field
   * is served by an API this console does not own and a type that omitted it would make
   * every other consumer's `RuntimeConfig` a different shape. The M14 section that edited
   * it is commented out; see `PayoutFileSection.tsx`.
   */
  payouts?: { export: PayoutExportTemplate };
  /**
   * Collection points / divisions this factory weighs at.
   *
   * Kept in v2 though leaf collection moved to the factory's own console: the app shows a
   * supplier which point their leaf was weighed at, and the supplier code carries the
   * division suffix. It is app-facing data with an internal-facing name.
   */
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
 * Feature flags — **the app's set, and nothing else** (white-label.md → Feature flags).
 *
 * The docblock here used to claim the set was "identical to the app's" while the type
 * held ten flags against the app's fourteen: six the app gates surfaces on had no
 * control anywhere in the console, and two were console-only. That is the drift v2
 * exists to close. The console is the app's management surface, so this type is the
 * app's `FeatureFlags` (mobile `src/config/types.ts`) and the M14 screen is the only
 * place any of them can be changed.
 *
 * Most of these gate nothing the console renders — `enableBiometricLogin` is a phone
 * capability — and that is expected. **Editing a flag is a console feature; obeying it
 * is the app's job.** The three that also gate a console surface say so on the field.
 *
 * A flag that only hides a screen is a UI preference, not a policy — the API must
 * refuse the call too, with `403 feature-disabled` (AC-07).
 */
export interface FeatureFlagSet {
  /* ── Tea-domain surfaces. These gate a console queue as well as an app screen. ── */
  enableSavings: boolean;
  enableAdvances: boolean;
  enableLoans: boolean;
  enableManure: boolean;
  /** Packets of made tea from the factory store. Gates the M18 queue. */
  enableTeaPackets: boolean;
  enableInquiry: boolean;
  enableNews: boolean;
  enablePushNotifications: boolean;
  /** Gates the banner editor inside M11, and the banner itself in the app. */
  enablePromoBanner: boolean;

  /* ── App-only surfaces. Edited here (M14), rendered only on the phone. ── */
  enableOnboarding: boolean;
  enableBiometricLogin: boolean;
  enableDarkModeToggle: boolean;
  enableProfileTab: boolean;
  enableAutoLock: boolean;

  /* ────────────────────────────────────────────────────────────────────────────
   * v1 console-only flags, kept for reference.
   *
   * `enablePayouts` and `enableReports` gated M6 and M16 — a payout run and the
   * factory's four reports. Both are the factory's own internal console's work in
   * v2, and neither flag exists in the app's `FeatureFlags`, so a console that went
   * on serving them would be offering the office a switch the app has never read.
   *
   * M16's surviving report (`channelShift`, the app-adoption KPI) is deliberately
   * left ungated, for the same reason M12, M14 and M15 have no flag: it is not a
   * feature a factory buys or declines.
   *
   *   enablePayouts: boolean;
   *   enableReports: boolean;
   * ──────────────────────────────────────────────────────────────────────────── */
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

  /* M5 Bills. `bills-unbalanced` is a refusal to *generate*, not a warning:
     itemized lines that disagree with their total (BR-107) must never reach a
     supplier's slip, and finding it after the publish is finding it too late. */
  'bills-missing',
  'bills-unbalanced',
  /** The leaf moved after the run: publishing would freeze the wrong figures. */
  'bills-stale',

  /* M11 / M12 Content. The fallback language is the only hard requirement — content
     with gaps is publishable because the app falls back (AC-08), and content with no
     fallback is not, because there would be nothing to fall back to. */
  'fallback-translation-missing',
  'slug-taken',
  'content-not-published',

  /* M14 Configuration. `flag-has-records` is the load-bearing one: turning off a
     money-bearing feature would hide a liability the factory still owes suppliers. */
  'tenant-immutable',
  'flag-has-records',
  'point-in-use',
  'fallback-language-required',

  /* M15 Users & roles. `last-admin` is the refusal that keeps a factory from locking
     itself out of its own console. */
  'last-admin',
  'self-modification',
  'email-taken',
  'unknown-role',

  /* M13 Notifications. `unknown-category` is the one that matters: the app **drops** a
     push whose category it does not recognize, so a send the console called successful
     would reach nobody and report nothing. */
  'unknown-category',
  'category-disabled',
  'no-recipients',
  'push-not-configured',

  /* M6 Payouts. `month-not-published` is the load-bearing one: a run against an
     open month pays against figures that can still change. */
  'month-not-published',
  'run-exists',
  'already-approved',
  'run-not-approved',
  'no-payable-lines',
  'line-not-payable',

  /* M7 Credit. `stale-eligibility` is above, with the two refusals that have to
     exist — it is BR-310 and it predates this module. `over-ceiling` is its
     companion: eligibility that has *not* moved, against an amount that was never
     within it. Approving more than a supplier may draw is not a warning, because
     the money leaves and the next month's bill carries a deduction for it. */
  'over-ceiling',
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];
