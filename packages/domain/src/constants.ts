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
