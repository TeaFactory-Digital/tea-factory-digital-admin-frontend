/**
 * Zod schemas — the validation half of the shared model.
 *
 * These are shared with the backend for the same reason the types are: the
 * console validates so the clerk is told immediately, and the server validates
 * because that is the authority (§9.3). Two implementations of "a note is
 * required" drift; one does not.
 *
 * Messages here are **i18n keys**, not sentences. The console renders them
 * through `t()`, so a schema never carries English copy (BR-110).
 */

import { z } from 'zod';
import {
  MAX_DELIVERY_BATCH_ROWS,
  MAX_DELIVERY_KG,
  REQUEST_STATUSES,
} from '../constants';
import { isExactKg } from '../leafCollection';
import { round2 } from '../money';

/** Reusable: a non-empty, trimmed string carrying a key for its own error. */
const requiredString = (key: string, max = 200) =>
  z.string().trim().min(1, key).max(max, 'validation.tooLong');

/* ───────────────────────────────── Auth ───────────────────────────────── */

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: z.string().min(1, 'validation.required'),
  /** Kept for the session-lifetime choice; never stores the password itself. */
  rememberDevice: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const mfaSchema = z.object({
  /** TOTP: exactly six digits. A trimmed paste with a space must still pass. */
  code: z
    .string()
    .transform((v) => v.replace(/\s+/g, ''))
    .refine((v) => /^\d{6}$/.test(v), 'validation.mfaCode'),
});

export type MfaInput = z.infer<typeof mfaSchema>;

/* ─────────────────────────── Decisions (M7, M9) ─────────────────────────── */

/**
 * **Rejecting any request without a note is impossible** (AC-06).
 *
 * The note is not administrative garnish: the app renders it back to the
 * supplier as the reason, so an empty one produces a rejection the supplier
 * cannot understand and will phone about. A minimum length is deliberate —
 * "no" is a note that passes `min(1)` and fails the intent.
 */
export const decisionSchema = z.object({
  note: requiredString('validation.noteRequired', 1000).min(10, 'validation.noteTooShort'),
  attachmentIds: z.array(z.string()).optional(),
});

export type DecisionInput = z.infer<typeof decisionSchema>;

/* ───────────────────────────── M2 Suppliers ───────────────────────────── */

/** Sri Lankan NIC: old 9 digits + V/X, or the 12-digit form. */
const nicSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => /^(\d{9}[VX]|\d{12})$/.test(v), 'validation.nic');

/**
 * Sri Lankan mobile/land line, tolerant of the shapes an office actually types:
 * `0412283282`, `041-2283282`, `+94 41 228 3282`.
 */
const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(?:\+94|0)\d{9}$/.test(v), 'validation.phone');

export const supplierEditableSchema = z.object({
  name: requiredString('validation.required', 120),
  nic: nicSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  email: z.string().trim().email('validation.email').optional().or(z.literal('')),
  dateOfBirth: z.string().date('validation.date').optional().or(z.literal('')),
  homeAddress: z.string().trim().max(300, 'validation.tooLong').optional(),
  estateAddress: z.string().trim().max(300, 'validation.tooLong').optional(),
  collectionPoint: requiredString('validation.required', 80),
});

export type SupplierEditableInput = z.infer<typeof supplierEditableSchema>;

/**
 * A supplier code carries its division suffix, e.g. `5708 (MAKADURA)`.
 *
 * Uniqueness is **per factory** (§16.2) so this cannot be checked client-side —
 * the server answers `supplier-code-taken`. Shape is all that is validated here.
 */
export const supplierCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => /^\d{1,8}(\s*\([A-Z\s]{2,30}\))?$/.test(v), 'validation.supplierCode');

export const supplierRegistrationSchema = supplierEditableSchema.extend({
  supplierCode: supplierCodeSchema,
  paymentMethod: z.enum(['cheque', 'bankTransfer', 'cash']),
  /** Validated against the tenant's `savings.perKgOptions` at the call site. */
  savingsPerKg: z.number().min(0, 'validation.min'),
});

export type SupplierRegistrationInput = z.infer<typeof supplierRegistrationSchema>;

export const suspendSupplierSchema = z.object({
  reason: requiredString('validation.reasonRequired', 500).min(10, 'validation.noteTooShort'),
});

/* ─────────────────────────── M3 Leaf collection ─────────────────────────── */

/**
 * A Colombo-local calendar day, `YYYY-MM-DD` (BR-104).
 *
 * Validated as a string rather than coerced to a `Date`, because the moment this
 * becomes a `Date` it acquires a timezone and the last day of a month can move
 * into the previous one.
 */
export const colomboDateSchema = z
  .string()
  .refine((v) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v), 'validation.date');

/**
 * One weighing, in kilos.
 *
 * Three refusals, each of which is a data-entry error rather than a policy:
 * zero or negative (a delivery that did not happen), above `MAX_DELIVERY_KG` (a
 * misplaced decimal point), and more than two decimals (a figure the database
 * would round without telling anybody).
 */
export const deliveryKgsSchema = z
  .number()
  .positive('validation.kgsPositive')
  .max(MAX_DELIVERY_KG, 'validation.kgsTooLarge')
  .refine(isExactKg, 'validation.kgsScale');

export const deliveryDraftSchema = z.object({
  supplierId: requiredString('validation.required', 60),
  kgs: deliveryKgsSchema,
});

export type DeliveryDraftInput = z.infer<typeof deliveryDraftSchema>;

/**
 * A whole weighing session.
 *
 * `rows` is capped because a batch is a session, not an import of the year: the
 * cap is what stops a malformed scale file arriving as a single 40,000-row commit
 * that neither the server nor the grid can report on usefully.
 */
export const deliveryBatchSchema = z.object({
  date: colomboDateSchema,
  collectionPoint: requiredString('validation.required', 80),
  batchId: requiredString('validation.required', 64),
  rows: z
    .array(deliveryDraftSchema)
    .min(1, 'validation.required')
    .max(MAX_DELIVERY_BATCH_ROWS, 'validation.batchTooLarge'),
});

export type DeliveryBatchInput = z.infer<typeof deliveryBatchSchema>;

/**
 * Voiding a delivery needs a reason, for the same reason a rejection does.
 *
 * A withdrawn weighing is a kilo figure that existed and then did not, and the
 * supplier who was handed a slip for it will ask. "Voided on the 14th" with no
 * why is a conversation nobody in the office can have.
 */
export const voidDeliverySchema = z.object({
  reason: requiredString('validation.reasonRequired', 500).min(10, 'validation.noteTooShort'),
});

/* ───────────────────────────── Shared queries ───────────────────────────── */

export const requestStatusSchema = z.enum(REQUEST_STATUSES);

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

/**
 * A `monthKey` — `"2026-07"`. Months travel as keys, never as display strings
 * (§17.1), because the console and the app localize month names differently.
 */
export const monthKeySchema = z
  .string()
  .refine((v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v), 'validation.monthKey');

/* ─────────────────────── M4 Rates & month close ─────────────────────── */

/**
 * The auction result, as the office types it.
 *
 * `positive` on the rate and `nonnegative` on the extra, deliberately different:
 * a month with no auction rate is a month with no rate *entered*, which is a
 * different state from zero — while an extra of zero is a real answer the factory
 * gives most months. The precision guard is `round2`, because a rate is money and
 * money is two places (§16).
 */
export const monthlyRateSchema = z.object({
  ratePerKg: z
    .number()
    .positive('validation.ratePositive')
    .max(10_000, 'validation.rateTooLarge')
    .refine((value) => round2(value) === value, 'validation.moneyScale'),
  extraRatePerKg: z
    .number()
    .nonnegative('validation.rateNonNegative')
    .max(10_000, 'validation.rateTooLarge')
    .refine((value) => round2(value) === value, 'validation.moneyScale'),
});

export type MonthlyRateInput = z.infer<typeof monthlyRateSchema>;

/**
 * Resolving an exception takes a note, and the note is the whole point.
 *
 * A month that closed with eleven exceptions marked resolved and no reasons is a
 * month nobody can defend six months later — which is exactly when it is asked
 * about (AC-04).
 */
export const resolveExceptionSchema = z.object({
  note: requiredString('validation.noteRequired', 1000).min(10, 'validation.noteTooShort'),
});

/**
 * Publishing is irreversible, so the confirmation carries the month key the
 * accountant is looking at.
 *
 * Not ceremony: the screen can be left open on July while somebody else publishes
 * June, and a publish that took "the current month" from the server would close
 * the wrong one. The key travels from the screen and the server must match it.
 */
export const publishMonthSchema = z.object({
  monthKey: monthKeySchema,
  note: z.string().max(1000).optional(),
});

/* ────────────────────────────── M5 Bills ────────────────────────────── */

/**
 * Generating bills for a month.
 *
 * The key travels in the body as well as the path for the same reason the publish
 * does: the screen can sit open on July while a colleague works June, and
 * recomputing "the current month" would rebuild the wrong one.
 */
export const generateBillsSchema = z.object({
  monthKey: monthKeySchema,
});

/* ───────────────────────────── M6 Payouts ───────────────────────────── */

export const paymentMethodSchema = z.enum(['cheque', 'bankTransfer', 'cash']);

/**
 * Preparing a run: one month, one method.
 *
 * The method is required rather than defaulted. "Which of these am I paying" is
 * the question the office answers before it opens a bank portal or a cheque book,
 * and a run that guessed would be a run somebody signs off without noticing.
 */
export const createPayoutRunSchema = z.object({
  monthKey: monthKeySchema,
  method: paymentMethodSchema,
});

export const approvePayoutRunSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

/**
 * Reconciling one line against what the bank or the counter actually did.
 *
 * **A failure needs a reason and a payment does not**, and the asymmetry is the
 * point: "paid" is self-explanatory, while a refused transfer is something the
 * office has to act on — the supplier has not been paid, and the note is what the
 * next person picking the run up has to work from.
 */
export const markPayoutLineSchema = z
  .object({
    status: z.enum(['paid', 'failed']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.status !== 'failed' || (value.reason?.length ?? 0) >= 10, {
    message: 'validation.reasonRequired',
    path: ['reason'],
  });

export type MarkPayoutLineInput = z.infer<typeof markPayoutLineSchema>;
