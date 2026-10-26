/**
 * Factory records kept in this system, for a factory whose own system is not connected.
 *
 * The platform's job is the supplier app. Normally its figures (suppliers, the day's leaf,
 * the month's rate, bills, balances) arrive from the factory's own system by the hourly
 * sync. A factory whose system cannot be reached switches the sync **off**, and then the
 * office keeps those records here: one at a time on a form, or many at once from an Excel
 * or CSV file. The bills are then calculated here (`computeBillAmounts`), reviewed by the
 * office and published to the app.
 *
 * **One source at a time.** With the sync on, every record below is read only in the
 * console and the entry screens are hidden. Two sources writing the same weighing is how a
 * bill comes to disagree with itself.
 *
 * The full design, screens and API are in `docs/v2/factory-records.md`.
 */

import { round2 } from './money';
import type { CreditFacility, PaymentMethod } from './types/app';
import type { SupplierRegistration } from './types/admin';

/* ───────────────────────────── the switch ───────────────────────────── */

/**
 * The configuration block for the switch. **Absent or `null` means off** (the factory's
 * decision): a factory keeps its records here until its own system is connected and the
 * sync is switched on deliberately. None is connected yet.
 */
export interface FactorySyncSetting {
  enabled: boolean;
}

/** Is the factory's own system the source of suppliers, leaf, rates, bills and balances? */
export function isFactorySyncEnabled(config: { factorySync?: FactorySyncSetting | null }): boolean {
  return config.factorySync?.enabled === true;
}

/* ─────────────────────────── advance interest ─────────────────────────── */

/**
 * Interest on an advance, set in Configuration, for the bills calculated here.
 *
 * **Simple interest, monthly**, on the advance still owed after the month's instalment:
 * that is how the printed slip reads (the advance balance, then the interest on it, both
 * carried to the next account). The interest is added to the advance the next bill
 * recovers, so it is repaid like the advance itself and never compounds within a month.
 *
 * Per month rather than per year because that is how a factory office quotes it ("one
 * percent a month"), and the person typing it should type the number they say.
 */
export interface AdvanceInterestSetting {
  /** Percent a month. `0` charges nothing, which is also what an absent setting means. */
  monthlyRatePercent: number;
}

export const DEFAULT_ADVANCE_INTEREST: AdvanceInterestSetting = { monthlyRatePercent: 0 };

/** The highest monthly rate the form accepts. Above it is almost certainly a typing slip. */
export const MAX_ADVANCE_INTEREST_PERCENT = 10;

export function advanceInterestProblem(setting: AdvanceInterestSetting): 'out-of-range' | null {
  const rate = setting.monthlyRatePercent;
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_ADVANCE_INTEREST_PERCENT
    ? null
    : 'out-of-range';
}

/** One month's interest on an advance balance. `0` for no balance or no rate. */
export function advanceInterestFor(
  balance: number,
  setting: AdvanceInterestSetting | undefined,
): number {
  const rate = setting?.monthlyRatePercent ?? 0;
  if (!(balance > 0) || !(rate > 0)) return 0;
  return round2((balance * rate) / 100);
}

/**
 * How a loan's interest is recovered on the bill, set by the factory in Configuration:
 *
 * - `onTop`: the planned instalment **plus** the interest. Rs. 50,000 over 10 months at
 *   Rs. 500 interest deducts Rs. 5,500, and the loan falls by Rs. 5,000.
 * - `withinInstalment`: the planned instalment only, the interest taken out of it. The same
 *   loan deducts Rs. 5,000, and the loan falls by Rs. 4,500.
 */
export type LoanInterestRecovery = 'onTop' | 'withinInstalment';

export interface LoanInterestSetting extends AdvanceInterestSetting {
  /** Absent: `onTop`. */
  recovery?: LoanInterestRecovery;
}

/**
 * One month of a loan on the bill. The interest is worked on the loan **owed at the start
 * of the month** (Rs. 50,000 at 1% is Rs. 500), never on unpaid interest.
 */
export function loanRecovery(
  owedAtStart: number,
  plannedInstalment: number,
  setting: LoanInterestSetting | undefined,
): { interest: number; deducted: number; principalRepaid: number } {
  const interest = advanceInterestFor(owedAtStart, setting);
  const instalment = round2(Math.max(0, Math.min(plannedInstalment, owedAtStart)));
  if ((setting?.recovery ?? 'onTop') === 'withinInstalment') {
    return { interest, deducted: instalment, principalRepaid: round2(Math.max(0, instalment - interest)) };
  }
  return { interest, deducted: round2(instalment + interest), principalRepaid: instalment };
}

/* ─────────────────────── comparing with the printed slip ─────────────────────── */

/**
 * A factory whose bills are calculated here still runs its own system, which **prints its
 * own slip**. The supplier holds both, so they must agree. Before a month is published the
 * office enters each printed slip's "Balance" (the amount paid), and every bill is one of:
 *
 * - `match`: ours pays the same, to the rupee.
 * - `mismatch`: they differ. Find the line that differs (leaf, rate, an approval entered in
 *   one system only), fix it in the system that is wrong, regenerate, compare again.
 * - `missing`: no printed figure entered yet.
 *
 * A bill that does not match must be **held** before the month can be published
 * (`409 bills-mismatch`). A held bill is left out of the publish, so the supplier never sees
 * a figure the factory did not pay; it is fixed, compared again, and **released** on its own.
 */
export type SlipComparison = 'match' | 'mismatch' | 'missing';

export function compareWithSlip(
  ours: number | null | undefined,
  printed: number | null | undefined,
): SlipComparison {
  if (printed === null || printed === undefined) return 'missing';
  return round2(ours ?? 0) === round2(printed) ? 'match' : 'mismatch';
}

/** What the office has recorded against one bill. On `AdminBill`. */
export interface SlipCheck {
  /** The printed slip's "Balance". `null` until entered. */
  printedFinalBalance?: number | null;
  /** Set while the bill is held back from publishing. */
  heldAt?: string | null;
  heldByName?: string | null;
  holdReason?: string | null;
  /**
   * Held **because** this supplier's bill for an earlier month is held, set by the
   * generation, not by a person. Its coins, debt and loan balance come from that bill, so
   * it waits: release the earlier one, recalculate this month, compare, release this one.
   */
  heldForMonth?: string | null;
}

/** One bill that needs the office's attention (anything but a match, or held). */
export interface SlipComparisonRow {
  billId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  ours: number | null;
  printed: number | null;
  /** ours − printed; `null` while the printed figure is missing. */
  difference: number | null;
  status: SlipComparison;
  held: boolean;
  holdReason: string | null;
  /** `SlipCheck.heldForMonth`. */
  heldForMonth: string | null;
}

/** `GET /admin/months/:monthKey/slip-comparison`. */
export interface MonthSlipComparison {
  monthKey: string;
  counts: Record<SlipComparison | 'held', number>;
  /** Everything that is not a plain match: mismatches, missing figures, held bills. */
  rows: SlipComparisonRow[];
}

/** May this month be published? Every bill matches, or is held. */
export function slipComparisonBlocks(rows: readonly SlipComparisonRow[]): SlipComparisonRow[] {
  return rows.filter((row) => row.status !== 'match' && !row.held);
}

/** The smallest checks before the server's. A hold needs a reason the manager can read. */
export const HOLD_REASON_MIN = 10;

/* ─────────────────────────── the bill's own rules ─────────────────────────── */

/**
 * How the bills calculated here are paid and numbered, so they read like the factory's
 * own printed slip. Set in Configuration.
 */
export interface BillSettings {
  /** Pay in whole units of this many rupees; the rest is coins carried forward. */
  paymentUnit: number;
  /**
   * The serial the next new bill takes (`factoryBillNumber`): the number after the factory's
   * last paper bill. Six digits, growing to seven past 999999. Absent: the console's own `GL/YYYY-MM/NNNN` numbers.
   */
  nextBillSerial?: number;
  /**
   * Where this factory's bills come from while it keeps its records here: `imported`, the
   * finished bills its own system printed (galaboda), or `calculated` here from the leaf
   * and the rate. One per factory, so a calculated month can never be published and then
   * stand in the way of the real slips. Absent: `calculated`.
   */
  source?: BillSource;
}

export type BillSource = 'imported' | 'calculated';

/** The one reading of `BillSettings.source`. */
export function billSourceOf(settings: Pick<BillSettings, 'source'> | undefined): BillSource {
  return settings?.source ?? 'calculated';
}

export const PAYMENT_UNITS = [1, 5, 10] as const;

export const DEFAULT_BILL_SETTINGS: BillSettings = { paymentUnit: 1 };

export function billSettingsProblem(settings: BillSettings): 'payment-unit' | 'bill-serial' | null {
  if (!(PAYMENT_UNITS as readonly number[]).includes(settings.paymentUnit)) return 'payment-unit';
  const serial = settings.nextBillSerial;
  if (serial !== undefined && !(Number.isInteger(serial) && serial >= 1 && serial <= 9_999_999)) {
    return 'bill-serial';
  }
  return null;
}

/* ───────────────────────── one record at a time ───────────────────────── */

/**
 * What a supplier owed and held on the day this system took over their records.
 *
 * Without it the first bill deducts nothing for a loan taken last year, and the app shows
 * headroom the supplier has already used. Entered once per supplier; locked as soon as a
 * bill has been published for them, after which the ledgers carry the balances forward.
 */
export interface OpeningBalances {
  /** The first month this system's bills cover, `YYYY-MM`. Balances are as at its start. */
  asOfMonth: string;
  advance: number;
  loan: number;
  manure: number;
  teaPackets: number;
  savings: number;
  /** Unpaid balance carried from the factory's last bill. */
  previousDebt: number;
  /**
   * A loan already running when this system took over has no plan here, so these say
   * where it stands: the monthly accounts still to repay over, and the instalments
   * already recovered (the next bill prints "Loans / Advance <paid + 1>"). Both optional:
   * without them the loan is recovered under the loan cap alone and numbered from 1.
   */
  loanMonthsLeft?: number | null;
  loanInstalmentsPaid?: number | null;
}

export interface OpeningBalancesRecord extends OpeningBalances {
  /** `false` once a bill has been published for the supplier. */
  editable: boolean;
  updatedAt: string;
  updatedByName: string;
  note: string;
}

/**
 * A supplier registered in the console. `supplierCode` must be the factory's own code, the
 * number on the passbook, so that switching the sync on later matches the same person
 * instead of creating a second one.
 */
export interface NewSupplier extends SupplierRegistration {
  /** Required when `paymentMethod` is `bankTransfer`. */
  bankDetails?: { bankName: string; branchName: string; accountNumber: string };
}

/**
 * A credit request the supplier made at the office counter, not in the app.
 *
 * It joins the same queue as an app request (channel `office`) and needs the same second
 * person to approve it: the clerk who records it cannot decide it.
 */
export interface WalkInCreditRequest {
  supplierId: string;
  facility: CreditFacility;
  amount: number;
  /** Loans only: how many monthly accounts the repayment is spread over. */
  repaymentMonths?: number;
  /** Manure only. */
  manureType?: string;
  quantityKg?: number;
  /** What the supplier said, and anything the office checked. Required. */
  note: string;
}

/**
 * The one bill line the office types: "other deductions" (`otherCards` on the wire).
 *
 * Every other line is calculated. This one covers the small deductions the factory adds by
 * hand, with a reason the supplier reads under the line in the app. Only before the month
 * is published; after that a correction goes on the next month's bill.
 */
export interface BillAdjustment {
  otherCards: number;
  /** Shown to the supplier under the line. Required when the amount is not zero. */
  otherCardsNote: string;
}

/** The smallest checks the form makes before the server does the real ones. */
export function billAdjustmentProblem(body: BillAdjustment): 'negative' | 'note-required' | null {
  if (!Number.isFinite(body.otherCards) || body.otherCards < 0) return 'negative';
  if (body.otherCards > 0 && body.otherCardsNote.trim().length < 3) return 'note-required';
  return null;
}

/**
 * A supplier's own transport rate, over their collection point's (`transportRateFor`).
 * `null` puts them back on the point's rate. The note says why, for the audit.
 */
export interface SupplierTransportRate {
  transportPerKg: number | null;
  note: string;
}

/* ──────────────────────────── many at once ──────────────────────────── */

/** Everything that can be imported from a file. One endpoint each: `POST /admin/imports/:kind`. */
export const IMPORT_KINDS = [
  'suppliers',
  'deliveries',
  'monthlyRates',
  'openingBalances',
  'walkInCredit',
  'billAdjustments',
  'transportRates',
  'bills',
  'printedBalances',
] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export type ImportColumnType = 'text' | 'number' | 'date' | 'month' | 'enum';

export interface ImportColumn {
  /** The header in the file, exactly. English and fixed, so a template works in any language. */
  key: string;
  type: ImportColumnType;
  required: boolean;
  /** For `enum`. */
  values?: readonly string[];
  /** For `number`: the most decimal places accepted. `0` is a whole number. Default 2. */
  decimals?: number;
  /** For `text`: the fewest characters accepted (the server's own floor). */
  minLength?: number;
  /** For `number`: a value below zero is real (a bill's balance in a month owed). */
  allowNegative?: boolean;
  /** For `number`: the range accepted (`must-be-positive` below `min`, `too-large` above `max`). */
  min?: number;
  max?: number;
  /**
   * The header must be in the file even though a cell may be blank (blank is 0). For a
   * balance a missing column would read as 0 for every supplier, so its absence is refused
   * once, on row 1 (`missing-column`; `missingImportColumns`).
   */
  headerRequired?: boolean;
  /** One example value, used in the template. */
  example: string;
}

const PAYMENT_METHODS: readonly PaymentMethod[] = ['bankTransfer', 'cheque', 'cash'];
const FACILITIES: readonly CreditFacility[] = ['advance', 'loan', 'manure'];

/**
 * The columns of each file. **Shared with the API**, which validates the same names and
 * types, so a file the console accepts is a file the server accepts.
 *
 * Suppliers are matched by `supplierCode` everywhere: it is the number on the passbook and
 * the one the office already types.
 */
export const IMPORT_COLUMNS: Record<ImportKind, readonly ImportColumn[]> = {
  suppliers: [
    { key: 'supplierCode', type: 'text', required: true, example: '5147' },
    { key: 'name', type: 'text', required: true, example: 'Kamal Perera' },
    { key: 'nic', type: 'text', required: true, example: '883210456V' },
    { key: 'phone', type: 'text', required: false, example: '0771234567' },
    { key: 'collectionPoint', type: 'text', required: true, example: 'DENIYAYA' },
    { key: 'paymentMethod', type: 'enum', required: true, values: PAYMENT_METHODS, example: 'bankTransfer' },
    { key: 'savingsPerKg', type: 'number', required: false, example: '2' },
    { key: 'bankName', type: 'text', required: false, example: 'Bank of Ceylon' },
    { key: 'branchName', type: 'text', required: false, example: 'Akuressa' },
    { key: 'accountNumber', type: 'text', required: false, example: '0071234567' },
    { key: 'homeAddress', type: 'text', required: false, example: 'No 12, Deniyaya Road, Akuressa' },
  ],
  deliveries: [
    { key: 'date', type: 'date', required: true, example: '2026-10-08' },
    { key: 'supplierCode', type: 'text', required: true, example: '5147' },
    { key: 'kg', type: 'number', required: true, example: '24.5' },
    { key: 'collectionPoint', type: 'text', required: false, example: 'DENIYAYA' },
  ],
  monthlyRates: [
    { key: 'month', type: 'month', required: true, example: '2026-09' },
    { key: 'ratePerKg', type: 'number', required: true, example: '118.75' },
    { key: 'extraRatePerKg', type: 'number', required: false, example: '6' },
  ],
  openingBalances: [
    { key: 'supplierCode', type: 'text', required: true, example: '5147' },
    { key: 'asOfMonth', type: 'month', required: true, example: '2026-10' },
    { key: 'advance', type: 'number', required: false, example: '0' },
    { key: 'loan', type: 'number', required: false, example: '45000' },
    { key: 'manure', type: 'number', required: false, example: '3200' },
    { key: 'teaPackets', type: 'number', required: false, example: '0' },
    { key: 'savings', type: 'number', required: false, example: '12850' },
    { key: 'previousDebt', type: 'number', required: false, example: '0' },
    { key: 'loanMonthsLeft', type: 'number', required: false, decimals: 0, example: '4' },
    { key: 'loanInstalmentsPaid', type: 'number', required: false, decimals: 0, example: '2' },
  ],
  walkInCredit: [
    { key: 'supplierCode', type: 'text', required: true, example: '5147' },
    { key: 'facility', type: 'enum', required: true, values: FACILITIES, example: 'advance' },
    { key: 'amount', type: 'number', required: true, example: '10000' },
    { key: 'repaymentMonths', type: 'number', required: false, decimals: 0, example: '' },
    { key: 'manureType', type: 'text', required: false, example: '' },
    { key: 'quantityKg', type: 'number', required: false, example: '' },
    { key: 'note', type: 'text', required: true, minLength: 10, example: 'Asked at the counter' },
  ],
  billAdjustments: [
    { key: 'month', type: 'month', required: true, example: '2026-09' },
    { key: 'supplierCode', type: 'text', required: true, example: '5147' },
    { key: 'otherCards', type: 'number', required: true, example: '350' },
    { key: 'otherCardsNote', type: 'text', required: false, example: 'Society membership' },
  ],
  /** Suppliers on their own rate. An empty `transportPerKg` puts them back on the point's. */
  transportRates: [
    { key: 'supplierCode', type: 'text', required: true, example: '5147' },
    { key: 'transportPerKg', type: 'number', required: false, example: '4' },
    { key: 'note', type: 'text', required: false, example: 'Estate beyond the river' },
  ],
  /**
   * A month's finished bills, as the factory's own system printed them: the other way to
   * fill a month, beside calculating it here. Every figure is taken as printed; the checks
   * below only make sure each row adds up, which catches a shifted column. The example row
   * is a real galaboda slip (July 2026).
   */
  bills: [
    { key: 'month', type: 'month', required: true, example: '2026-07' },
    { key: 'supplierCode', type: 'text', required: true, example: '5708' },
    { key: 'billNo', type: 'text', required: false, example: '2026210869' },
    { key: 'billDate', type: 'date', required: false, example: '2026-08-10' },
    { key: 'totalKg', type: 'number', required: true, example: '509.5' },
    { key: 'ratePerKg', type: 'number', required: true, example: '222' },
    { key: 'extraRatePerKg', type: 'number', required: false, example: '3' },
    { key: 'coinsBroughtForward', type: 'number', required: false, example: '7.41' },
    { key: 'greenLeafAmount', type: 'number', required: true, example: '113109' },
    { key: 'extraPayment', type: 'number', required: false, example: '1528.5' },
    { key: 'grossAmount', type: 'number', required: true, example: '114644.91' },
    { key: 'transportCharges', type: 'number', required: false, example: '0' },
    { key: 'tea', type: 'number', required: false, example: '1298' },
    { key: 'savings', type: 'number', required: false, example: '5095' },
    { key: 'loansAdvance', type: 'number', required: false, example: '0' },
    { key: 'loanInstalmentNo', type: 'number', required: false, decimals: 0, min: 1, max: 360, example: '' },
    { key: 'advance', type: 'number', required: false, example: '40000' },
    { key: 'manure', type: 'number', required: false, example: '0' },
    { key: 'otherCards', type: 'number', required: false, example: '0' },
    { key: 'otherCardsNote', type: 'text', required: false, example: '' },
    { key: 'stamps', type: 'number', required: false, example: '25' },
    { key: 'previousDebts', type: 'number', required: false, example: '0' },
    { key: 'totalDeductions', type: 'number', required: true, example: '46418' },
    { key: 'balanceAmount', type: 'number', required: true, allowNegative: true, example: '68226.91' },
    { key: 'savingsWithdrawal', type: 'number', required: false, example: '0' },
    { key: 'coinsCarriedForward', type: 'number', required: false, example: '6.91' },
    // Paid in whole rupees (the factory's unit is 1, 5 or 10).
    { key: 'finalBalance', type: 'number', required: true, decimals: 0, example: '68220' },
    { key: 'nextMonthDebt', type: 'number', required: false, example: '0' },
    { key: 'loanBalance', type: 'number', required: false, headerRequired: true, example: '0' },
    { key: 'manureBalance', type: 'number', required: false, headerRequired: true, example: '0' },
    { key: 'loanInterest', type: 'number', required: false, example: '0' },
    { key: 'savingsPrevious', type: 'number', required: false, example: '21970' },
    { key: 'savingsToDate', type: 'number', required: false, headerRequired: true, example: '27065' },
  ],
  /**
   * The "Balance" (the amount paid) on each slip the factory's own system printed, for a
   * factory whose bills are calculated here: compared with ours before the month is
   * published (`compareWithSlip`).
   */
  printedBalances: [
    { key: 'month', type: 'month', required: true, example: '2026-07' },
    { key: 'supplierCode', type: 'text', required: true, example: '5708' },
    { key: 'finalBalance', type: 'number', required: true, example: '68220' },
  ],
};

/** The nine deduction columns of an imported bill, in the slip's order. */
export const IMPORTED_BILL_DEDUCTIONS = [
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

/**
 * Does an imported bill row add up? Each check names the column it doubts. Sums are held
 * to the cent; the two rate products to a rupee, because a factory may round them.
 */
function importedBillProblems(row: ImportRow, line: number): ImportRowProblem[] {
  const n = (key: string) => {
    const value = (row[key] ?? '').trim();
    return value === '' ? 0 : Number(value);
  };
  const near = (a: number, b: number, within: number) => Math.abs(a - b) <= within + 1e-9;
  // Every sum exact in whole cents, as the database holds money.
  const cents = (value: number) => Math.round(value * 100);
  const same = (a: number, b: number) => cents(a) === cents(b);
  const out: ImportRowProblem[] = [];
  const doubt = (column: string) => out.push({ row: line, column, code: 'does-not-add-up' });

  const kg = n('totalKg');
  // A month's bill has a rate: 0 or less is a shifted or empty column, not a price.
  if ((row.ratePerKg ?? '').trim() !== '' && !(n('ratePerKg') > 0)) {
    out.push({ row: line, column: 'ratePerKg', code: 'must-be-positive' });
  }
  // The rate products may differ by a rupee (the factory's system may round per weighing);
  // every sum must agree to the cent.
  if (!near(n('greenLeafAmount'), kg * n('ratePerKg'), 1)) doubt('greenLeafAmount');
  if (!near(n('extraPayment'), kg * n('extraRatePerKg'), 1)) doubt('extraPayment');
  if (cents(n('grossAmount')) !== cents(n('greenLeafAmount')) + cents(n('extraPayment')) + cents(n('coinsBroughtForward'))) {
    doubt('grossAmount');
  }
  const lines = IMPORTED_BILL_DEDUCTIONS.reduce((sum, key) => sum + cents(n(key)), 0);
  if (cents(n('totalDeductions')) !== lines) doubt('totalDeductions');
  if (cents(n('balanceAmount')) !== cents(n('grossAmount')) - cents(n('totalDeductions'))) doubt('balanceAmount');
  // Paid plus held back is the balance plus any savings paid back on this bill. Below zero,
  // nothing is paid and the shortfall is next month's debt.
  const payable = cents(n('balanceAmount')) + cents(n('savingsWithdrawal'));
  const paidAndHeld = cents(n('finalBalance')) + cents(n('coinsCarriedForward'));
  if (payable >= 0) {
    if (paidAndHeld !== payable) doubt('finalBalance');
    // Nothing is owed when the account covered its deductions.
    if (cents(n('nextMonthDebt')) !== 0) doubt('nextMonthDebt');
  } else {
    if (n('finalBalance') !== 0) doubt('finalBalance');
    // Nothing is paid, so nothing is held back as coins either.
    if (cents(n('coinsCarriedForward')) !== 0) doubt('coinsCarriedForward');
    if (cents(n('nextMonthDebt')) !== -payable) doubt('nextMonthDebt');
  }
  // Savings To-date already has this month's withdrawal taken off (the factory, 24 October
  // 2026): previous + this month − withdrawal. Checked once any savings figure is stated;
  // a blank cell is 0.
  const savingsStated = ['savingsPrevious', 'savings', 'savingsToDate'].some((key) => (row[key] ?? '').trim() !== '');
  if (savingsStated && !same(n('savingsToDate'), n('savingsPrevious') + n('savings') - n('savingsWithdrawal'))) {
    doubt('savingsToDate');
  }
  if (n('otherCards') > 0 && (row.otherCardsNote ?? '').trim().length < 3) {
    out.push({ row: line, column: 'otherCardsNote', code: 'required' });
  }
  return out;
}

/** One row as read from a file: every value is still text. */
export type ImportRow = Record<string, string>;

export interface ImportRowProblem {
  /** 1-based, counting the header as row 1, so it matches what the spreadsheet shows. */
  row: number;
  column?: string;
  /**
   * The rupees a problem is about, where it has one: `approval-missing` names what we
   * approved that the slip lacks (the column says which line: `advance`, `tea`,
   * `savingsWithdrawal`, `loanBalance`, `manureBalance`).
   */
  amount?: number;
  code:
    | 'required'
    | 'not-a-number'
    | 'negative'
    | 'too-many-decimals'
    | 'not-a-date'
    | 'not-a-month'
    | 'not-allowed'
    | string;
}

/**
 * A row left out because it is already there, which is **not** a problem: the rest of the
 * file still saves. Only the kinds in `IMPORT_SKIP_KINDS` skip rows.
 *
 * - `already-recorded` (`deliveries`): the same date, supplier, kilos and collection point
 *   is already recorded and not voided (`leafRecordKey`, `matchRecorded`).
 * - `supplier-exists` (`suppliers`): a supplier with this code is already on the roll. It
 *   is left as it is, not updated from the file.
 */
export type ImportSkipCode = 'already-recorded' | 'supplier-exists';

export interface ImportSkippedRow {
  /** The spreadsheet row, as in `ImportRowProblem`. */
  row: number;
  code: ImportSkipCode;
}

/** The kinds a file may be imported again without doubling anything. */
export const IMPORT_SKIP_KINDS: ReadonlySet<ImportKind> = new Set<ImportKind>(['deliveries', 'suppliers']);

/**
 * What to do with leaf rows already recorded. `skip` is the default. `import` is for the
 * rare file that really holds a second weighing of the same kilos on the same day.
 */
export type ImportDuplicates = 'skip' | 'import';

/** `POST /admin/imports/:kind`. */
export interface ImportRequest {
  fileName: string;
  rows: ImportRow[];
  /**
   * Check the file and say what **would** happen (`saved`, `skipped`, `problems`) without
   * saving anything. The import dialog asks this first, so the office sees which rows are
   * already there before it presses Import.
   */
  dryRun?: boolean;
  /** `deliveries` only. Default `skip`. */
  duplicates?: ImportDuplicates;
}

/** What the server answers. All or nothing: any problem and no row is saved. */
export interface ImportResult {
  kind: ImportKind;
  /** Rows saved; on a dry run, rows that would be saved. */
  saved: number;
  /** At most 500 are sent back; `problemTotal` is how many there were in all. */
  problems: ImportRowProblem[];
  problemTotal?: number;
  /** Rows left out because they are already there. At most 500; `skippedTotal` counts all. */
  skipped?: ImportSkippedRow[];
  skippedTotal?: number;
  /** Echoed: nothing was saved. */
  dryRun?: boolean;
  /**
   * `bills` only (A8): the slip's kilos are kept, and this says how many suppliers' kilos
   * differ from the leaf entered here for the month, and by how many kilos in all.
   */
  leafDifferences?: { suppliers: number; kgs: number };
}

/**
 * One weighing, as the import matches it: no weighing number exists on the factory's
 * scale file, so the date, the supplier, the kilos (to the gram) and the collection point
 * together are the identity. The point is the row's, or the supplier's own when the row
 * leaves it empty, exactly as the import saves it.
 */
export function leafRecordKey(date: string, supplierId: string, kgs: number, collectionPoint: string): string {
  return `${date}|${supplierId}|${kgs.toFixed(3)}|${collectionPoint.trim().toUpperCase()}`;
}

/**
 * Which incoming weighings are already recorded, **by count**: two identical weighings in
 * the file against one already recorded leaves one to save. So importing the same file
 * twice adds nothing, while a supplier who really brought 20 kg twice that day keeps both.
 * Answers the indexes of `incoming` to skip.
 */
export function matchRecorded(recorded: readonly string[], incoming: readonly string[]): number[] {
  const left = new Map<string, number>();
  for (const key of recorded) left.set(key, (left.get(key) ?? 0) + 1);
  const skip: number[] = [];
  incoming.forEach((key, index) => {
    const count = left.get(key) ?? 0;
    if (count > 0) {
      skip.push(index);
      left.set(key, count - 1);
    }
  });
  return skip;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/**
 * Plain decimal digits only. `Number()` alone accepts `0x1A`, `1e3`, `Infinity` and a
 * blank-padded value, and a spreadsheet cell that reads like any of them is a typing slip,
 * not a weight.
 */
const DECIMAL = /^-?\d+(\.(\d+))?$/;

/** A real calendar day: `2026-02-31` has the right shape and is not a date. */
function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * The checks the console makes on each row before sending, so the office fixes the file
 * before anything is sent. The server repeats them and adds the ones only it can make (an
 * unknown supplier code, a published month, a duplicate).
 */
export function importRowProblems(kind: ImportKind, rows: readonly ImportRow[]): ImportRowProblem[] {
  const problems: ImportRowProblem[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const before = problems.length;
    for (const column of IMPORT_COLUMNS[kind]) {
      const value = (row[column.key] ?? '').trim();
      if (!value) {
        if (column.required) problems.push({ row: line, column: column.key, code: 'required' });
        continue;
      }
      if (column.type === 'number') {
        const match = DECIMAL.exec(value);
        if (!match) problems.push({ row: line, column: column.key, code: 'not-a-number' });
        else if (value.startsWith('-') && !column.allowNegative) {
          problems.push({ row: line, column: column.key, code: 'negative' });
        }
        else if ((match[2]?.length ?? 0) > (column.decimals ?? 2)) {
          // Refused rather than rounded: a scale that printed 24.555 kg, rounded here, is a
          // figure the supplier's passbook will not show.
          problems.push({ row: line, column: column.key, code: 'too-many-decimals' });
        } else if (column.min !== undefined && Number(value) < column.min) {
          problems.push({ row: line, column: column.key, code: 'must-be-positive' });
        } else if (column.max !== undefined && Number(value) > column.max) {
          problems.push({ row: line, column: column.key, code: 'too-large' });
        }
      } else if (column.type === 'text' && column.minLength && value.length < column.minLength) {
        problems.push({ row: line, column: column.key, code: 'too-short' });
      } else if (column.type === 'date' && !isCalendarDate(value)) {
        problems.push({ row: line, column: column.key, code: 'not-a-date' });
      } else if (column.type === 'month' && !MONTH.test(value)) {
        problems.push({ row: line, column: column.key, code: 'not-a-month' });
      } else if (column.type === 'enum' && !column.values?.includes(value)) {
        problems.push({ row: line, column: column.key, code: 'not-allowed' });
      }
    }
    // A bill row is checked for adding up only once every figure in it is a number.
    if (kind === 'bills' && problems.length === before) problems.push(...importedBillProblems(row, line));
  });
  return problems;
}

/**
 * The columns a file's header lacks: every required one, and every `headerRequired` one (a
 * blank cell is fine there, a missing column is not). The console refuses the file before
 * sending it; the server answers the same as `missing-column` on row 1.
 */
export function missingImportColumns(kind: ImportKind, headers: readonly string[]): string[] {
  return IMPORT_COLUMNS[kind]
    .filter((column) => (column.required || column.headerRequired) && !headers.includes(column.key))
    .map((column) => column.key);
}

/** The template: the header row and one example row, as CSV text. */
export function importTemplateCsv(kind: ImportKind): string {
  const columns = IMPORT_COLUMNS[kind];
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return `${columns.map((c) => c.key).join(',')}\n${columns.map((c) => cell(c.example)).join(',')}\n`;
}
