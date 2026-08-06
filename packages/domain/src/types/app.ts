/**
 * The supplier-facing domain model — a verbatim port of the mobile app's
 * `src/types/index.ts`.
 *
 * **This file is the schema of record** (api.md §17.1). The console, the API and
 * the app must all speak it, which is the entire argument for this package: a
 * change to `GreenLeafBill` breaks the build in every consumer instead of
 * producing three subtly different DTOs.
 *
 * Two invariants travel with these types and are easy to lose in a transport
 * swap (operations.md → Migrating from the mock layer):
 *
 *  - `null` on a rate-derived field means "the auction result is not in".
 *    Never coerce it to `0` (BR-102) — the console renders a different state.
 *  - List ordering is part of the contract: newest-first for request lists,
 *    oldest-first for the savings ledger and income summaries.
 *
 * Keep this file free of imports. It is shared with a React Native bundle.
 */

/** Minimal factory identity embedded in documents like a bill. */
export interface FactoryInfo {
  name: string;
  telephone: string;
  /** Business registration number. */
  regNo: string;
  location: string;
}

/** How a supplier is paid by the factory. */
export type PaymentMethod = 'cheque' | 'bankTransfer' | 'cash';

/** Lifecycle of any request that needs factory sign-off. */
export type RequestStatus = 'pending' | 'approved' | 'rejected';

/** A supplier's bank payout details. */
export interface BankDetails {
  bankName: string;
  accountNumber: string;
  branchName: string;
}

/** The supplier (green-leaf grower) as the app knows them. */
export interface Supplier {
  id: string;
  /** Factory supplier code, e.g. "5708 (MAKADURA)". Unique **per factory**. */
  supplierCode: string;
  name: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  homeAddress?: string;
  /** Address of the tea estate/land supplying leaf. */
  estateAddress?: string;
  bankDetails?: BankDetails;
  paymentMethod: PaymentMethod;
  /**
   * Approved savings deducted from the bill per kilo of green leaf, in LKR.
   * `0` = the supplier has opted out of the scheme. Only the factory can change
   * this; the app asks for it through a change request (§14.2).
   */
  savingsPerKg: number;
  /** Index into the bundled default avatar set. */
  avatarId?: number;
}

/** One day's leaf supply within a month (sparse: null = no supply that day). */
export interface DailySupply {
  day: number;
  kgs: number | null;
}

/** Itemized deductions on a Green Leaf Account. Sum must equal `total` (BR-107). */
export interface BillDeductions {
  transportCharges: number;
  tea: number;
  savings: number;
  loansAdvance: number;
  advance: number;
  manure: number;
  otherCards: number;
  stamps: number;
  previousDebts: number;
  total: number;
}

/** Balances carried into the next month. */
export interface BillCarryForward {
  nextMonthDeb: number;
  /** Slip wording: this is the **advance** balance (§9.4). */
  loanBalance: number;
  manureBalance: number;
  loanInterest: number;
}

/** Savings snapshot printed on the bill. */
export interface BillSavingsSummary {
  thisMonth: number;
  previous: number;
  toDate: number;
}

/**
 * The monthly "Green Leaf Account" — mirrors the factory's printed slip.
 *
 * A **read model, not a table** (api.md §16): daily deliveries and a monthly
 * rate are the facts, and this is generated from them at month close.
 */
export interface GreenLeafBill {
  id: string;
  factory: FactoryInfo;
  supplierCode: string;
  supplierName: string;
  billNo: string;
  /** ISO timestamp. */
  billDateTime: string;
  /** Display month, e.g. "APRIL 2026". */
  month: string;
  /** Machine key for sorting/selection, e.g. "2026-04". */
  monthKey: string;
  year: number;

  /**
   * False while the month's tea auction result is still pending. Every
   * rate-derived amount below is then `null` and must not be shown as a figure.
   */
  auctionResultAvailable: boolean;

  ratePerKg: number | null;
  extraRatePerKg: number | null;
  totalRatePerKg: number | null;
  totalKgs: number;

  coinsBroughtForward: number;
  /**
   * Savings the supplier asked back this month, paid on this account (§21.9).
   *
   * **An addition, not a negative deduction**, and it sits here beside
   * `coinsBroughtForward` because the two behave the same way: neither is money the leaf
   * earned, and both are added after the nine lines have been taken off. Folding it into
   * `deductions` would break BR-107, which balances those nine against their own total.
   *
   * `0` when nothing was asked for — a real zero, not a missing value: every account has a
   * savings position, and most months it is untouched.
   */
  savingsWithdrawal: number;
  greenLeafAmount: number | null;
  extraPayment: number | null;
  grossAmount: number | null;

  deductions: BillDeductions;

  balanceAmount: number | null;
  coinsCarriedForward: number;
  finalBalance: number | null;

  carryForward: BillCarryForward;
  savingsSummary: BillSavingsSummary;

  dailySupply: DailySupply[];
  paymentMethod: PaymentMethod;
}

/** Compact row for the income-history list/graph (derived from a bill). */
export interface IncomeSummary {
  monthKey: string;
  month: string;
  year: number;
  totalKgs: number;
  auctionResultAvailable: boolean;
  grossAmount: number | null;
  finalBalance: number | null;
}

/** One movement in the savings ledger. */
export interface SavingsLedgerEntry {
  monthKey: string;
  month: string;
  /** Positive = contribution, negative = withdrawal. */
  amount: number;
  /** Running balance after this entry. */
  balance: number;
}

/** Cash against leaf already supplied this month. */
export interface AdvanceRequest {
  id: string;
  amount: number;
  reason?: string;
  status: RequestStatus;
  createdAt: string;
  note?: string;
  /** Accounts the supplier chose to repay over. See `LoanRequest.repaymentMonths`. */
  repaymentMonths?: number;
}

/** Cash against a track record of income, repaid over later accounts. */
export interface LoanRequest {
  id: string;
  amount: number;
  reason?: string;
  status: RequestStatus;
  createdAt: string;
  note?: string;
  /**
   * How many accounts the supplier chose to spread the repayment over (§21.10).
   *
   * **The supplier's decision, not the office's** — which is most of what §21.10 turned out
   * to be about. Optional because it arrives from the app, and every credit approved before
   * the app could ask for it has none: those fall back to the factory's share-of-gross cap
   * alone, which is what the console did before.
   */
  repaymentMonths?: number;
}

/** Fertilizer taken on credit. */
export interface ManureRequest {
  id: string;
  /** One of the factory's configured types (§21.10). */
  manureType: string;
  quantityKg: number;
  deliveryNotes?: string;
  status: RequestStatus;
  createdAt: string;
  note?: string;
  /** Accounts the supplier chose to repay over. See `LoanRequest.repaymentMonths`. */
  repaymentMonths?: number;
}

/** The three credit facilities, as a discriminator. */
export type CreditFacility = 'advance' | 'loan' | 'manure';

/** What kind of profile change requires factory approval. */
export type ChangeRequestType = 'paymentMethod' | 'bankDetails' | 'savingsRate';

/**
 * A pending change to how a supplier is paid, or to their savings rate. While
 * `pending`, the app keeps showing the currently-active values.
 */
export interface ChangeRequest {
  id: string;
  type: ChangeRequestType;
  status: RequestStatus;
  createdAt: string;
  /** Human-readable summary of the current value. */
  currentSummary: string;
  /** Human-readable summary of the requested value. */
  requestedSummary: string;
  requestedPaymentMethod?: PaymentMethod;
  requestedBankDetails?: BankDetails;
  /** Requested savings deduction per kilo, in LKR (`0` = opt out). */
  requestedSavingsPerKg?: number;
}

/** A factory blog/news post, localized server-side by `lang`. */
export interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  publishedAt: string;
}

/** A page of news for infinite scroll. Reuse this shape for any unbounded list. */
export interface NewsPage {
  items: NewsArticle[];
  nextPage: number | null;
}

/** A message to the factory office + any reply. */
export interface Inquiry {
  id: string;
  subject: string;
  message: string;
  status: RequestStatus;
  createdAt: string;
  reply?: string;
}

/**
 * What the factory may notify a supplier about. The app drops any push whose
 * `data.category` is not one of these rather than opening an arbitrary screen,
 * so the console must send a recognized value (push-notifications.md).
 */
export type NotificationCategory =
  | 'billPublished'
  | 'requestDecided'
  | 'newsArticle'
  | 'inquiryReplied';

/**
 * Where a promo banner's button takes the supplier. `screen` stays in the app;
 * `url` leaves for the browser or dialler. The app refuses any other scheme.
 */
export type BannerAction =
  | { type: 'screen'; path: string }
  | { type: 'url'; url: string };

/** A full-width announcement the factory shows on the way into the app. */
export interface PromoBanner {
  id: string;
  imageUrl?: string;
  /** Width ÷ height, so the layout reserves space before the image arrives. */
  imageAspectRatio?: number;
  title: string;
  body?: string;
  buttonLabel: string;
  action: BannerAction;
  startsAt: string;
  endsAt: string | null;
}

/** One notification the factory sent this supplier, as the in-app list shows it. */
export interface NotificationMessage {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  sentAt: string;
  /** ISO timestamp the supplier opened it, or null while unread. */
  readAt: string | null;
  data?: Record<string, string>;
}

/** A device registered to receive push. The token is the identity, not the session. */
export interface RegisteredDevice {
  id: string;
  token: string;
  platform: 'ios' | 'android';
  categories: NotificationCategory[];
  registeredAt: string;
}

export type Nullable<T> = T | null;
