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

/** The configuration block for the switch. Absent means "on": the platform's normal case. */
export interface FactorySyncSetting {
  enabled: boolean;
}

/** Is the factory's own system the source of suppliers, leaf, rates, bills and balances? */
export function isFactorySyncEnabled(config: { factorySync?: FactorySyncSetting }): boolean {
  return config.factorySync?.enabled ?? true;
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
   * last paper bill. Absent: the console's own `GL/YYYY-MM/NNNN` numbers.
   */
  nextBillSerial?: number;
}

export const PAYMENT_UNITS = [1, 5, 10] as const;

export const DEFAULT_BILL_SETTINGS: BillSettings = { paymentUnit: 1 };

export function billSettingsProblem(settings: BillSettings): 'payment-unit' | 'bill-serial' | null {
  if (!(PAYMENT_UNITS as readonly number[]).includes(settings.paymentUnit)) return 'payment-unit';
  const serial = settings.nextBillSerial;
  if (serial !== undefined && !(Number.isInteger(serial) && serial >= 1 && serial <= 999999)) {
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
 * bill has been generated for them, after which the ledgers carry the balances forward.
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
}

export interface OpeningBalancesRecord extends OpeningBalances {
  /** `false` once a bill has been generated for the supplier. */
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
  ],
  walkInCredit: [
    { key: 'supplierCode', type: 'text', required: true, example: '5147' },
    { key: 'facility', type: 'enum', required: true, values: FACILITIES, example: 'advance' },
    { key: 'amount', type: 'number', required: true, example: '10000' },
    { key: 'repaymentMonths', type: 'number', required: false, example: '' },
    { key: 'manureType', type: 'text', required: false, example: '' },
    { key: 'quantityKg', type: 'number', required: false, example: '' },
    { key: 'note', type: 'text', required: true, example: 'Asked at the counter' },
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
};

/** One row as read from a file: every value is still text. */
export type ImportRow = Record<string, string>;

export interface ImportRowProblem {
  /** 1-based, counting the header as row 1, so it matches what the spreadsheet shows. */
  row: number;
  column?: string;
  code: 'required' | 'not-a-number' | 'negative' | 'not-a-date' | 'not-a-month' | 'not-allowed' | string;
}

/** What the server answers. All or nothing: any problem and no row is saved. */
export interface ImportResult {
  kind: ImportKind;
  saved: number;
  problems: ImportRowProblem[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The checks the console makes on each row before sending, so the office fixes the file
 * before anything is sent. The server repeats them and adds the ones only it can make (an
 * unknown supplier code, a published month, a duplicate).
 */
export function importRowProblems(kind: ImportKind, rows: readonly ImportRow[]): ImportRowProblem[] {
  const problems: ImportRowProblem[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    for (const column of IMPORT_COLUMNS[kind]) {
      const value = (row[column.key] ?? '').trim();
      if (!value) {
        if (column.required) problems.push({ row: line, column: column.key, code: 'required' });
        continue;
      }
      if (column.type === 'number') {
        const n = Number(value);
        if (!Number.isFinite(n)) problems.push({ row: line, column: column.key, code: 'not-a-number' });
        else if (n < 0) problems.push({ row: line, column: column.key, code: 'negative' });
      } else if (column.type === 'date' && !DATE.test(value)) {
        problems.push({ row: line, column: column.key, code: 'not-a-date' });
      } else if (column.type === 'month' && !MONTH.test(value)) {
        problems.push({ row: line, column: column.key, code: 'not-a-month' });
      } else if (column.type === 'enum' && !column.values?.includes(value)) {
        problems.push({ row: line, column: column.key, code: 'not-allowed' });
      }
    }
  });
  return problems;
}

/** The template: the header row and one example row, as CSV text. */
export function importTemplateCsv(kind: ImportKind): string {
  const columns = IMPORT_COLUMNS[kind];
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return `${columns.map((c) => c.key).join(',')}\n${columns.map((c) => cell(c.example)).join(',')}\n`;
}
