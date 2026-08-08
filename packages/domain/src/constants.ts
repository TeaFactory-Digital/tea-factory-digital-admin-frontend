/**
 * Policy constants and closed vocabularies.
 *
 * Everything here is **tenant policy that the backend will eventually own**
 * (white-label.md → What is tenant-scoped and what is global). The values below
 * are the offline defaults; once `GET /config` serves them, the console must
 * display the served number rather than this one — the rule banners quote these
 * figures to a supplier, and a console showing a different ceiling from the app
 * turns every rejection into a dispute.
 */

/** Closed months of income required before a loan or manure release (§9.1). */
export const REQUIRED_MONTHS_OF_HISTORY = 6;

/** A loan ceiling is this multiple of average monthly income (§9.1). */
export const LIMIT_MULTIPLIER = 3;

/**
 * Every date a clerk types or reads is a **Colombo-local** day (BR-104).
 * A delivery recorded at 23:30 local is that day's delivery, and rendering its
 * UTC timestamp in the grid would move the row across midnight.
 */
export const FACTORY_TIME_ZONE = 'Asia/Colombo';

/** Money is LKR everywhere, and payloads carry no symbol (BR-110). */
export const CURRENCY_CODE = 'LKR';

/** Money is NUMERIC(14,2) — two decimal places, never a float (BR-109). */
export const MONEY_SCALE = 2;

/** Kilos are NUMERIC(10,2). */
export const KG_SCALE = 2;

/**
 * The nine itemized deduction lines, in slip order.
 *
 * Global: which nine they are is the printed Green Leaf Account's shape. The
 * *values*, and which of them the office may set per supplier, are tenant policy
 * and still an open question (status.md §21.10).
 */
export const DEDUCTION_CATEGORIES = [
  'transportCharges',
  'tea',
  'savings',
  'loansAdvance',
  'advance',
  'manure',
  'otherCards',
  'stamps',
  'previousDebts',
] as const;

export type DeductionCategory = (typeof DEDUCTION_CATEGORIES)[number];

/** The three credit facilities, each behind its own feature flag. */
export const CREDIT_FACILITIES = ['advance', 'loan', 'manure'] as const;

/** Request lifecycle, shared by every queue. */
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;

/** Languages the platform supports. Which a factory *enables* is tenant config. */
export const SUPPORTED_LANGUAGES = ['si', 'en', 'ta'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Editorial copy falls back to English when a translation is missing, and the
 * gap must be visible to the editor (AC-08). This is the fallback, not a default.
 */
export const EDITORIAL_FALLBACK_LANGUAGE: LanguageCode = 'en';

/* ──────────────────── M11 News · M12 Static content ──────────────────── */

/**
 * `draft` never seen by a supplier · `published` live in the app · `archived` taken
 * out of the feed without being deleted.
 *
 * There is no `deleted`. An article a supplier has already read and may refer to on the
 * telephone is a record, so it is archived — the same rule that voids a delivery rather
 * than removing it (§12.1).
 */
export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * The app's fixed pages.
 *
 * A **closed set, not a collection**, and that is the whole difference between M12 and
 * M11: nobody creates a "terms" page, they edit the one that exists. The app links to
 * these slugs directly, so adding one is a mobile release and inventing one in the
 * console would be a link to nowhere.
 *
 * `faq` is first because AC-11 is about it.
 */
export const STATIC_PAGE_SLUGS = [
  'faq',
  'savingsScheme',
  'creditTerms',
  'about',
  'terms',
  'privacy',
] as const;

export type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];

/**
 * How long a news body may be.
 *
 * Generous, because the office pastes a circular in. It is a guard against a paste that
 * ran away rather than an editorial limit — the app scrolls.
 */
export const MAX_CONTENT_BODY_CHARS = 20_000;
export const MAX_CONTENT_TITLE_CHARS = 160;
export const MAX_CONTENT_EXCERPT_CHARS = 300;

/**
 * Whether a request came from the app or was entered by the office.
 *
 * Not decoration: **app adoption and channel shift are the two KPIs that
 * justify the project** (operations.md §19.3), and neither is measurable unless
 * office-originated requests land in the same tables with this column set.
 */
export const REQUEST_CHANNELS = ['app', 'office'] as const;

export type RequestChannel = (typeof REQUEST_CHANNELS)[number];

/* ─────────────────────────── M3 Leaf collection ─────────────────────────── */

/**
 * The hard ceiling on a single weighing, in kilos.
 *
 * A typo filter rather than a business rule: a smallholder delivers tens of
 * kilos, so a five-figure entry is a misplaced decimal point. It is set far
 * above any real load on purpose — refusing a legitimate estate delivery would
 * send the weighing point back to a paper ledger, and an office that has learned
 * the screen sometimes lies stops reading it.
 */
export const MAX_DELIVERY_KG = 5000;

/**
 * Rows one commit may carry.
 *
 * The grid commits a whole weighing session in **one** call: a row-per-request
 * design makes a 200-row session 200 round trips on office wifi, which is the
 * difference between a working product and a paper ledger.
 */
export const MAX_DELIVERY_BATCH_ROWS = 200;

/**
 * When to *ask* about a kilo figure rather than refuse it.
 *
 * A running total only catches a mistyped kilo if somebody reads it, so the grid
 * flags a row that is both more than `OUTLIER_KG_MULTIPLE` times the session's
 * mean **and** above `OUTLIER_KG_FLOOR_KG`. The floor is what stops the first two
 * rows of a session flagging each other.
 *
 * Both are offline defaults. What counts as a plausible delivery is tenant
 * policy — an estate route and a smallholder route disagree by an order of
 * magnitude — and the factory has not been asked yet (docs/status.md).
 */
export const OUTLIER_KG_MULTIPLE = 3;
export const OUTLIER_KG_FLOOR_KG = 150;

/* ───────────────────────── M6 Payouts · M8 Savings ───────────────────────── */

export const PAYOUT_RUN_STATUSES = ['draft', 'approved', 'completed'] as const;

/**
 * Ordered by where a line sits in the office's day: waiting, stuck, done, refused.
 * The grid's default sort follows this, so the lines needing attention are on top.
 */
export const PAYOUT_LINE_STATUSES = ['pending', 'held', 'paid', 'failed'] as const;

export const SAVINGS_ENTRY_SOURCES = [
  'openingBalance',
  'billDeduction',
  'adjustment',
  'withdrawal',
  'interest',
] as const;

/**
 * The whole-rupee granularity the factory pays in.
 *
 * Not cosmetic: the sub-rupee remainder is the printed slip's "coins" line and it
 * carries into the next account, which is why `coinsBroughtForward` exists in the
 * bill type at all. A payout of `LKR 4,213.47` is a figure no cheque is written for.
 */
export const PAYOUT_ROUNDING_UNIT = 1;

/* ─────────────────────── M7 Credit · M10 Inquiries ─────────────────────── */

/**
 * Which flag each facility hangs off.
 *
 * As data rather than a `switch`, because three places need the mapping — the
 * queue's facility filter, the dashboard's queue list and the API's `feature-disabled`
 * gate — and three switches over the same three cases is three places to forget
 * a facility when a fourth is added.
 */
export const CREDIT_FACILITY_FLAGS = {
  advance: 'enableAdvances',
  loan: 'enableLoans',
  manure: 'enableManure',
} as const satisfies Record<(typeof CREDIT_FACILITIES)[number], string>;

/**
 * How an inquiry ends.
 *
 * **Three states, and §21.18 asked for two.** The question is whether
 * Resolved/Closed is the right pair; `open` is not in dispute, so the vocabulary
 * here is the two proposed outcomes plus the state everything starts in. They are
 * genuinely different acts: `resolved` is "the supplier was answered", `closed` is
 * "this needed no answer" — a duplicate, a wrong number, a message meant for the
 * weighing point. Collapsing them would make "how many did we actually answer"
 * unanswerable, which is the one number §19.3's channel-shift KPI needs.
 *
 * Statuses are **data**, so an answer that adds `escalated` adds a row here rather
 * than a migration.
 */
export const INQUIRY_STATUSES = ['open', 'resolved', 'closed'] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/**
 * The §14.4 service-level target per queue, in hours.
 *
 * Only the change-request figure is specified — three working days — and the other
 * three are **this console's guess**, sized by how much a supplier is waiting on:
 * an advance is cash against leaf already in the shed, so a day is already slow; an
 * inquiry is a question, so a working day is the promise; a loan is underwritten
 * against six months of history and nobody expects it the same afternoon.
 *
 * Offline defaults, like every other policy number here. Once `GET /config` serves
 * them the console must display the served figure — a queue colouring red at a
 * threshold the factory never agreed to is a console the office learns to ignore.
 */
export const QUEUE_SLA_HOURS = {
  changeRequests: 72,
  advanceRequests: 24,
  loanRequests: 120,
  manureRequests: 72,
  /**
   * Tea packets sit with manure at three days, and for the same reason: it is stock
   * leaving a store rather than money leaving an account. The supplier is waiting on a
   * storekeeper to have it ready, not on a decision about their creditworthiness.
   */
  teaPacketRequests: 72,
  inquiries: 24,
} as const;

/* ─────────────────────── M13 Notifications ─────────────────────── */

export const NOTIFICATION_SEND_STATUSES = ['queued', 'sent', 'failed'] as const;

export type NotificationSendStatus = (typeof NOTIFICATION_SEND_STATUSES)[number];

/**
 * Where a send came from.
 *
 * `automatic` fired off a console event; `composed` was written by a person. Kept apart
 * because they answer different questions and the office asks both: "did the bill
 * notification go out" is a system question, and "who told every supplier the factory is
 * closed on Friday" is not.
 */
export const NOTIFICATION_ORIGINS = ['automatic', 'composed'] as const;

export type NotificationOrigin = (typeof NOTIFICATION_ORIGINS)[number];

/**
 * A push payload is not an article.
 *
 * Both platforms truncate a long notification on the lock screen, and a supplier who has
 * to open the app to find out what the factory said is a supplier who stops opening it.
 * These are guards against a paste, not editorial limits.
 */
export const MAX_PUSH_TITLE_CHARS = 65;
export const MAX_PUSH_BODY_CHARS = 240;
