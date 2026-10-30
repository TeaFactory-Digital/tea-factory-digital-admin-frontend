/**
 * Wire error → the i18n key that explains it.
 *
 * The server's `message` is English-only and a fallback (§17.4); localized copy
 * lives in the string tables. Mapping by `code` is only possible because the
 * transport preserves the domain code instead of flattening it to the HTTP status,
 * which is the whole reason §17.7's first fix matters.
 */

import { isApiError } from '@/services/api/errors';

const BY_CODE: Record<string, string> = {
  network: 'error.network',
  timeout: 'error.timeout',
  forbidden: 'error.forbidden',
  'feature-disabled': 'error.featureDisabled',
  'four-eyes-violation': 'error.fourEyesViolation',
  'already-decided': 'error.alreadyDecided',
  'note-required': 'error.noteRequired',
  /* BR-008: the new password is the one already on the account. */
  'password-unchanged': 'error.passwordUnchanged',
  /* Uploads (M11, M12). `upload-not-configured` is a 503 about the SERVER, not the file. */
  'upload-type': 'error.uploadType',
  'upload-too-large': 'error.uploadTooLarge',
  'upload-not-configured': 'error.uploadNotConfigured',
  'stale-eligibility': 'error.staleEligibility',
  invalid: 'error.invalid',
  /**
   * The record is gone: deleted, or never existed under that id.
   *
   * Mapped separately from the `'404'` fallback at the foot of this table and not
   * folded into it: the status is what an unrouted path answers, the code is what a
   * handler answers about a record it looked for and did not find. They resolve to
   * the same sentence today, and a table that only carried the status would go on
   * rendering "something went wrong" for every domain `not-found` the API sends.
   */
  'not-found': 'error.notFound',
  // M3. `month-locked` is the one a clerk meets most: it is what a published
  // month answers to every attempt to change the leaf it was built from (BR-108).
  'month-locked': 'error.monthLocked',
  'already-voided': 'error.alreadyVoided',
  'invalid-batch': 'error.invalidBatch',
  // M4. Each of these is a month the office would otherwise have closed wrongly.
  'already-published': 'error.alreadyPublished',
  'exceptions-open': 'error.exceptionsOpen',
  'rate-missing': 'error.rateMissing',
  'invalid-rate': 'error.invalidRate',
  'already-resolved': 'error.alreadyResolved',
  'month-mismatch': 'error.monthMismatch',
  'batch-too-large': 'error.batchTooLarge',
  // M5. `bills-missing` doubles as a *state* on the bills screen (a month that has
  // not been generated yet), which is why the run card checks the code itself rather
  // than rendering this string.
  'bills-missing': 'error.billsMissing',
  'bills-stale': 'error.billsStale',
  'bills-unbalanced': 'error.billsUnbalanced',
  // M6. Each of these is money that would otherwise have moved on the wrong basis.
  'month-not-published': 'error.monthNotPublished',
  'run-exists': 'error.runExists',
  'already-approved': 'error.alreadyApproved',
  'run-not-approved': 'error.runNotApproved',
  'no-payable-lines': 'error.noPayableLines',
  'line-not-payable': 'error.lineNotPayable',
  // M7. Both are refusals to lend: the ceiling moved under the approver
  // (BR-310), or the amount was never inside it.
  'over-ceiling': 'error.overCeiling',
  // M11 / M12. The fallback language is the only hard requirement on content: gaps
  // are publishable because the app falls back (AC-08), and no fallback is not.
  'fallback-translation-missing': 'error.fallbackTranslationMissing',
  'slug-taken': 'error.slugTaken',
  'content-not-published': 'error.contentNotPublished',
  // M13. `unknown-category` is the one with no feedback loop behind it: the app drops a
  // push it does not recognize, so a send the console called successful reaches nobody
  // and reports nothing.
  'unknown-category': 'error.unknownCategory',
  'category-disabled': 'error.categoryDisabled',
  'no-recipients': 'error.noRecipients',
  'push-not-configured': 'error.pushNotConfigured',
  // M14. `flag-has-records` is the load-bearing one: turning off a money-bearing feature
  // would hide a liability the factory still owes suppliers.
  'tenant-immutable': 'error.tenantImmutable',
  'flag-has-records': 'error.flagHasRecords',
  'point-in-use': 'error.pointInUse',
  'fallback-language-required': 'error.fallbackLanguageRequired',
  // M15. `last-admin` is the refusal that keeps a factory from locking itself out of its
  // own console, including the version where no *role* grants the capability any more.
  'last-admin': 'error.lastAdmin',
  'self-modification': 'error.selfModification',
  'email-taken': 'error.emailTaken',
  'unknown-role': 'error.unknownRole',
  // Factory records, kept here while the factory-system sync is off (factory-records.md).
  'factory-sync-on': 'error.factorySyncOn',
  'sync-switch-blocked': 'error.syncSwitchBlocked',
  'supplier-code-taken': 'error.supplierCodeTaken',
  'unknown-collection-point': 'error.unknownCollectionPoint',
  'bank-details-required': 'error.bankDetailsRequired',
  'opening-balances-locked': 'error.openingBalancesLocked',
  'cut-over-month': 'error.cutOverMonth',
  'withdrawal-pending': 'error.withdrawalPending',
  'correction-invalid': 'error.correctionInvalid',
  'approval-above-limit': 'error.approvalAboveLimit',
  'negative': 'error.negative',
  'unknown-supplier': 'error.unknownSupplier',
  'no-bill': 'error.noBill',
  'import-size': 'error.importSize',
  'import-invalid': 'error.importInvalid',
  // Credit refusals a walk-in or an approval can meet.
  'request-pending': 'error.requestPending',
  'supplier-suspended': 'error.supplierSuspended',
  'supplier-closed': 'error.supplierClosed',
  'advance-outstanding': 'error.advanceOutstanding',
  'loan-installments-invalid': 'error.loanInstallmentsInvalid',
  'manure-installments-invalid': 'error.manureInstallmentsInvalid',
  'loan-outstanding': 'error.loanOutstanding',
  'wrong-bill-source': 'error.wrongBillSource',
  'bill-source-blocked': 'error.billSourceBlocked',
  'bills-mismatch': 'error.billsMismatch',
  'bill-not-held': 'error.billNotHeld',
  'bill-still-mismatched': 'error.billStillMismatched',
  'earlier-bill-held': 'error.earlierBillHeld',
  'earlier-month-unpublished': 'error.earlierMonthUnpublished',
  'approval-missing': 'error.approvalMissing',
  'records-busy': 'error.recordsBusy',
  '403': 'error.forbidden',
  '404': 'error.notFound',
};

/**
 * By `details.reason`, checked before the code: `invalid` covers a dozen refusals, and
 * the reason is the only part that says which one.
 */
const BY_REASON: Record<string, string> = {
  // The API cannot apply a bank change yet: it does not keep the new account number.
  'bank-details-approval-not-implemented': 'changeRequests.bankNotReady.body',
  // A month published while the file waited: the file is fine, it just has to go again.
  'published-during-import': 'error.publishedDuringImport',
};

const CUT_OVER_REASONS = new Set(['future', 'first-bill-month', 'different']);

/** `details.reason`, when the server sent one. */
export function errorReason(error: unknown): string | undefined {
  if (!isApiError(error)) return undefined;
  const reason = (error.details as { reason?: unknown } | undefined)?.reason;
  return typeof reason === 'string' ? reason : undefined;
}

/** The i18n key for an error, falling back to a generic one. */
export function errorMessageKey(error: unknown): string {
  if (!isApiError(error)) return 'error.unknown';
  const reason = errorReason(error);
  if (reason && BY_REASON[reason]) return BY_REASON[reason];
  // `invalid` is also what a wrong password answers, with a 401. Any other `invalid` is a
  // request the server refused, and "Email or password is incorrect" under a decision
  // note sends the clerk looking for a password field.
  if (error.code === 'invalid' && error.status !== 401) return 'error.invalidRequest';
  // Which cut-over rule: the month has not begun, is not the first month with bills here, or
  // differs from the month the other suppliers' opening balances are as at.
  if (error.code === 'cut-over-month' && reason && CUT_OVER_REASONS.has(reason)) {
    return `error.cutOverMonth.${reason}`;
  }
  return BY_CODE[error.code] ?? 'error.unknown';
}

/**
 * The values an error's message names, from its `details`: today the months behind
 * `sync-switch-blocked`, printed as "2026-09, 2026-10", and the count behind `bills-mismatch`.
 */
export function errorMessageValues(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  const details = error.details as
    | { months?: unknown; count?: unknown; monthKey?: unknown; asOfMonth?: unknown }
    | undefined;
  const months = Array.isArray(details?.months) ? details.months.map(String).join(', ') : '';
  // `bills-mismatch`: how many bills still disagree with their printed slip.
  const count = typeof details?.count === 'number' ? String(details.count) : '';
  // `earlier-bill-held`: the month whose bill has to be released first; `cut-over-month`:
  // the factory's cut-over month.
  const month =
    typeof details?.monthKey === 'string'
      ? details.monthKey
      : typeof details?.asOfMonth === 'string'
        ? details.asOfMonth
        : '';
  return { ...(months ? { months } : {}), ...(count ? { count } : {}), ...(month ? { month } : {}) };
}

/**
 * Does this error deserve its own explanation rather than a toast?
 *
 * The set is "refusals a decision dialog can meet, where retrying the same click
 * cannot help". Each one leaves the submit button disabled: the clerk has to read
 * why and do something different: reload the figures, hand it to a colleague, or
 * reject it. A toast that vanishes is the wrong shape for all four.
 */
export function isBlockingError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return (
    error.code === 'four-eyes-violation' ||
    error.code === 'already-decided' ||
    error.code === 'stale-eligibility' ||
    error.code === 'over-ceiling' ||
    // The supplier's state, not the click: approving again cannot help (BR-303).
    error.code === 'supplier-suspended' ||
    error.code === 'supplier-closed' ||
    error.code === 'advance-outstanding' ||
    error.code === 'loan-outstanding'
  );
}
