/**
 * Wire error → the i18n key that explains it.
 *
 * The server's `message` is English-only and a fallback (§17.4); localized copy
 * lives in the string tables. Mapping by `code` is only possible because the
 * transport preserves the domain code instead of flattening it to the HTTP status
 * — which is the whole reason §17.7's first fix matters.
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
  'stale-eligibility': 'error.staleEligibility',
  invalid: 'error.invalid',
  'mfa-invalid': 'error.mfaInvalid',
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
  // M5. `bills-missing` doubles as a *state* on the bills screen — a month that has
  // not been generated yet — which is why the run card checks the code itself rather
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
  // M11 / M12. The fallback language is the only hard requirement on content — gaps
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
  // own console — including the version where no *role* grants the capability any more.
  'last-admin': 'error.lastAdmin',
  'self-modification': 'error.selfModification',
  'email-taken': 'error.emailTaken',
  'unknown-role': 'error.unknownRole',
  '403': 'error.forbidden',
  '404': 'error.notFound',
};

/** The i18n key for an error, falling back to a generic one. */
export function errorMessageKey(error: unknown): string {
  if (!isApiError(error)) return 'error.unknown';
  return BY_CODE[error.code] ?? 'error.unknown';
}

/**
 * Does this error deserve its own explanation rather than a toast?
 *
 * The set is "refusals a decision dialog can meet, where retrying the same click
 * cannot help". Each one leaves the submit button disabled: the clerk has to read
 * why and do something different — reload the figures, hand it to a colleague, or
 * reject it. A toast that vanishes is the wrong shape for all four.
 */
export function isBlockingError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return (
    error.code === 'four-eyes-violation' ||
    error.code === 'already-decided' ||
    error.code === 'stale-eligibility' ||
    error.code === 'over-ceiling'
  );
}
