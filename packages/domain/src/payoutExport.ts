/**
 * M6's payout file — **§21.17 answered as configuration rather than guessed as code.**
 *
 * The question the factory has not answered is *"what format does your bank accept?"* —
 * SLIPS, CEFTS, or the bank's own bulk-upload sheet. The tempting answer was three coded
 * serialisers behind a dropdown, and it is the wrong one twice over: two of the three
 * layouts would be invented, and a bank file the bank rejects is two hundred suppliers
 * unpaid until the run is re-sent. A wrong file is worse than no file.
 *
 * So what is configured here is the **layout**, not the format's name. Every "bank's own
 * CSV" is a permutation of the same five or six facts — account number, branch, name,
 * amount, a reference — and a template that says which of them, in what order, with what
 * headings and number formats, covers that whole family without inventing any of it.
 * `SLIPS` then becomes a **named preset somebody fills in once their bank confirms the
 * layout**, which is a config row rather than a release. The same shape as M13's answer to
 * §21.24: the factory's eventual answer is a switch, not a rewrite.
 *
 * **What this deliberately cannot do**, and why M6 still carries the §21.17 note:
 *
 *  - A **fixed-width** format with record types, control totals or a checksum. Those are
 *    rules, not a column order, and a template that pretended to express them would be the
 *    guess this module exists to avoid.
 *  - **Cheques on pre-printed stock.** That is millimetres on a specific cheque book, not
 *    a delimiter.
 *
 * Which is why nothing here is called "the bank file". It produces a spreadsheet of a run,
 * shaped the way the factory said to shape it.
 */

import { round2 } from './money';

/* ─────────────────────────── the fields a line can offer ─────────────────────────── */

/**
 * Everything a payout line knows that a bank could plausibly want.
 *
 * A closed list, because a template naming a field that does not exist is a column of
 * blanks in a payment file — and blanks in a payment file are rejected batches. The
 * console validates a template against this before it can be saved.
 */
export const PAYOUT_EXPORT_FIELDS = [
  'supplierCode',
  'supplierName',
  'accountNumber',
  'bankName',
  'branchName',
  'amount',
  'reference',
  'monthKey',
  'method',
] as const;

export type PayoutExportField = (typeof PAYOUT_EXPORT_FIELDS)[number];

export function isPayoutExportField(value: string): value is PayoutExportField {
  return (PAYOUT_EXPORT_FIELDS as readonly string[]).includes(value);
}

/**
 * The one field without which a file is not a payment instruction.
 *
 * A sheet with names and no amounts is a mailing list. Enforced rather than warned about,
 * because this is the mistake whose consequence is discovered at the bank.
 */
export const REQUIRED_EXPORT_FIELD: PayoutExportField = 'amount';

/**
 * Fields that are meaningless on a cheque or cash run.
 *
 * Not a refusal — a factory may well want one template for all three methods — but the
 * column comes out **empty** rather than inventing an account, and the console says so
 * before the run is downloaded.
 */
export const BANK_ONLY_FIELDS: readonly PayoutExportField[] = [
  'accountNumber',
  'bankName',
  'branchName',
];

/* ─────────────────────────────── the template ─────────────────────────────── */

/** What separates two values. Named rather than free text: a bank accepts one of these. */
export type PayoutExportDelimiter = 'comma' | 'semicolon' | 'pipe' | 'tab';

export const DELIMITER_CHARS: Record<PayoutExportDelimiter, string> = {
  comma: ',',
  semicolon: ';',
  pipe: '|',
  tab: '\t',
};

/**
 * How an amount is written.
 *
 * `cents` exists because a good many bulk-upload formats want an integer in the smallest
 * unit rather than a decimal — and a factory that sends `4213.00` where `421300` was
 * expected has under-paid every supplier by a factor of a hundred, which the bank will
 * happily process.
 */
export type PayoutAmountFormat = 'decimal2' | 'cents' | 'whole';

/** How an account number is written. Some portals reject anything but digits. */
export type PayoutAccountFormat = 'plain' | 'digitsOnly';

export interface PayoutExportColumn {
  field: PayoutExportField;
  /**
   * The **heading the bank expects**, verbatim.
   *
   * The one string in this codebase that is deliberately not an i18n key (BR-110). A bank's
   * upload sheet matches on the literal header text; translating it would break the file in
   * the one language the factory actually uses the console in.
   */
  label: string;
}

export interface PayoutExportTemplate {
  delimiter: PayoutExportDelimiter;
  /** Some portals want the header row; some reject it. */
  headerRow: boolean;
  columns: PayoutExportColumn[];
  amountFormat: PayoutAmountFormat;
  accountFormat: PayoutAccountFormat;
  /**
   * What goes in the `reference` column — the text the supplier sees on their bank
   * statement. `{code}` and `{month}` are substituted; everything else is literal.
   */
  referenceTemplate: string;
}

/* ─────────────────────────────── presets ─────────────────────────────── */

/**
 * Starting points, and **only one of them claims to be a bank's format.**
 *
 * `genericCsv` is what this module can honestly offer today: a readable spreadsheet of a
 * run. The other two are **empty-labelled skeletons deliberately left as a factory's job to
 * complete** — they carry the columns those schemes are known to need in roughly the order
 * they are usually asked for, so somebody with the bank's specification in front of them is
 * filling in headings rather than starting from nothing. They are named for what they are
 * *for*, not as a claim that the layout below is correct.
 *
 * If that reads as unsatisfying: that is the honest state of §21.17, and a preset that
 * asserted a layout nobody has confirmed would read as satisfying and be wrong.
 */
export const PAYOUT_EXPORT_PRESETS = {
  genericCsv: {
    delimiter: 'comma',
    headerRow: true,
    columns: [
      { field: 'supplierCode', label: 'Supplier Code' },
      { field: 'supplierName', label: 'Name' },
      { field: 'accountNumber', label: 'Account Number' },
      { field: 'bankName', label: 'Bank' },
      { field: 'branchName', label: 'Branch' },
      { field: 'amount', label: 'Amount' },
      { field: 'reference', label: 'Reference' },
    ],
    amountFormat: 'decimal2',
    accountFormat: 'plain',
    referenceTemplate: 'Green Leaf {month}',
  },
  slipsSkeleton: {
    delimiter: 'comma',
    headerRow: false,
    columns: [
      { field: 'accountNumber', label: '' },
      { field: 'branchName', label: '' },
      { field: 'supplierName', label: '' },
      { field: 'amount', label: '' },
      { field: 'reference', label: '' },
    ],
    amountFormat: 'cents',
    accountFormat: 'digitsOnly',
    referenceTemplate: 'GL{month}-{code}',
  },
  ceftsSkeleton: {
    delimiter: 'comma',
    // Headerless like the SLIPS skeleton, and for a reason found by its own test: with
    // headings switched on, every blank label is a `missing-label` refusal, so the preset
    // could not be saved at all. A starting point you cannot save is not a starting point —
    // turn headings on once you have the bank's specification and can fill them in.
    headerRow: false,
    columns: [
      { field: 'accountNumber', label: '' },
      { field: 'supplierName', label: '' },
      { field: 'bankName', label: '' },
      { field: 'branchName', label: '' },
      { field: 'amount', label: '' },
      { field: 'reference', label: '' },
    ],
    amountFormat: 'decimal2',
    accountFormat: 'digitsOnly',
    referenceTemplate: 'GL{month}-{code}',
  },
} as const satisfies Record<string, PayoutExportTemplate>;

export type PayoutExportPresetId = keyof typeof PAYOUT_EXPORT_PRESETS;

export const PAYOUT_EXPORT_PRESET_IDS = Object.keys(
  PAYOUT_EXPORT_PRESETS,
) as PayoutExportPresetId[];

/**
 * The preset a factory gets before it has configured anything.
 *
 * `genericCsv`, because it is the only one that is complete — a factory that downloads
 * before reading this screen gets a readable spreadsheet rather than a file of unlabelled
 * columns it might mistake for a bank format.
 */
export const DEFAULT_PAYOUT_EXPORT: PayoutExportTemplate = clonePayoutTemplate(
  PAYOUT_EXPORT_PRESETS.genericCsv,
);

export function clonePayoutTemplate(template: PayoutExportTemplate): PayoutExportTemplate {
  return { ...template, columns: template.columns.map((column) => ({ ...column })) };
}

/* ─────────────────────────────── validation ─────────────────────────────── */

export type PayoutTemplateProblem =
  | 'no-columns'
  | 'no-amount'
  | 'duplicate-field'
  | 'unknown-field'
  | 'missing-label';

/**
 * What is wrong with a template, shared so the screen can refuse it and the API can too.
 *
 * Ordered worst first. Each of these produces a file the bank rejects, and the person who
 * finds out is a supplier who was not paid — so all four are refusals, not warnings.
 */
export function payoutTemplateProblems(template: PayoutExportTemplate): PayoutTemplateProblem[] {
  const problems: PayoutTemplateProblem[] = [];
  const fields = template.columns.map((column) => column.field);

  if (fields.length === 0) problems.push('no-columns');
  if (fields.length > 0 && !fields.includes(REQUIRED_EXPORT_FIELD)) problems.push('no-amount');
  if (new Set(fields).size !== fields.length) problems.push('duplicate-field');
  if (fields.some((field) => !isPayoutExportField(field))) problems.push('unknown-field');
  // Only when the header row is actually written — a headerless format has no use for
  // labels, which is why the skeletons above can ship with empty ones.
  if (template.headerRow && template.columns.some((column) => !column.label.trim())) {
    problems.push('missing-label');
  }

  return problems;
}

export function isPayoutTemplateUsable(template: PayoutExportTemplate): boolean {
  return payoutTemplateProblems(template).length === 0;
}

/* ─────────────────────────────── serialising ─────────────────────────────── */

/**
 * One line's worth of facts, as the exporter needs them.
 *
 * `accountNumber` is the **full** number, not the masked one the grid carries (§20.4) — a
 * payment file with `••••4432` in it is not a payment file. That is why producing one is a
 * server-side, audited act rather than something the console assembles from a list it
 * already has on screen.
 */
export interface PayoutExportLine {
  supplierCode: string;
  supplierName: string;
  accountNumber: string | null;
  bankName: string | null;
  branchName: string | null;
  amount: number;
  monthKey: string;
  method: string;
}

function formatAmount(amount: number, format: PayoutAmountFormat): string {
  switch (format) {
    case 'cents':
      return String(Math.round(round2(amount) * 100));
    case 'whole':
      return String(Math.round(amount));
    default:
      return round2(amount).toFixed(2);
  }
}

function formatAccount(account: string | null, format: PayoutAccountFormat): string {
  if (!account) return '';
  return format === 'digitsOnly' ? account.replace(/\D/g, '') : account;
}

export function payoutReference(template: string, line: PayoutExportLine): string {
  return template.replace(/\{code\}/g, line.supplierCode).replace(/\{month\}/g, line.monthKey);
}

/**
 * Escape one value for a delimited file.
 *
 * Quoting is applied only when it is needed, because a portal that parses naively chokes on
 * quotes it did not expect — and a supplier called `Perera, K.` is not a hypothetical, so
 * *never* quoting is not an option either.
 */
function escapeValue(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r');
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

function valueFor(
  line: PayoutExportLine,
  field: PayoutExportField,
  template: PayoutExportTemplate,
): string {
  switch (field) {
    case 'supplierCode':
      return line.supplierCode;
    case 'supplierName':
      return line.supplierName;
    case 'accountNumber':
      return formatAccount(line.accountNumber, template.accountFormat);
    case 'bankName':
      return line.bankName ?? '';
    case 'branchName':
      return line.branchName ?? '';
    case 'amount':
      return formatAmount(line.amount, template.amountFormat);
    case 'reference':
      return payoutReference(template.referenceTemplate, line);
    case 'monthKey':
      return line.monthKey;
    default:
      return line.method;
  }
}

/**
 * The file, as text.
 *
 * **Shared, and that is the point of it living here.** The console shows the office a
 * preview of what it is about to download and the API produces the bytes; two
 * implementations would eventually differ, and the one time they differed would be a file
 * that looked right on screen and was rejected by the bank.
 *
 * CRLF line endings: every bank portal and every version of Excel reads them, and some
 * older upload parsers only read them.
 */
export function serialisePayoutFile(
  lines: readonly PayoutExportLine[],
  template: PayoutExportTemplate,
): string {
  const delimiter = DELIMITER_CHARS[template.delimiter];
  const rows: string[] = [];

  if (template.headerRow) {
    rows.push(template.columns.map((column) => escapeValue(column.label, delimiter)).join(delimiter));
  }

  for (const line of lines) {
    rows.push(
      template.columns
        .map((column) => escapeValue(valueFor(line, column.field, template), delimiter))
        .join(delimiter),
    );
  }

  // A trailing newline: a file whose last line has no terminator is the other thing naive
  // parsers drop, and dropping the last line means one supplier silently unpaid.
  return rows.join('\r\n') + '\r\n';
}

/** `payout-bankTransfer-2026-07.csv`. The month and method are what the office files by. */
export function payoutFileName(monthKey: string, method: string, delimiter: PayoutExportDelimiter) {
  return `payout-${method}-${monthKey}.${delimiter === 'tab' ? 'tsv' : 'csv'}`;
}
