/**
 * Factory-record features the API has not built yet (BACKEND-TODO #45).
 *
 * Their routes answer `404`, which the console would show as "That record no longer
 * exists". So they are hidden until the backend confirms each one; remove an entry the day
 * it ships. The mock implements all of them, so tests reach them through the repositories.
 */

import type { ImportKind } from '@tfd/domain';

export const IMPORT_KINDS_NOT_ON_SERVER: ReadonlySet<ImportKind> = new Set<ImportKind>([
  // `deliveries` and `monthlyRates` shipped with #45 step 3 (backend e4a9f40, 30 October 2026).
  'billAdjustments',
  'printedBalances',
]);

/** Saving opening balances (`PUT /admin/suppliers/:id/opening-balances`). */
export const OPENING_BALANCES_ON_SERVER = true;

/**
 * Corrections after a published bill (C5, BACKEND-TODO #57): `GET` and `POST
 * /admin/suppliers/:id/corrections`, and the bill's `corrections` lines.
 */
export const CORRECTIONS_ON_SERVER = false;

/** Typing other deductions on a bill (`PUT /admin/bills/:id/adjustment`). */
export const OTHER_DEDUCTIONS_ON_SERVER = false;

/**
 * Comparing calculated bills with the factory's printed slips, and holding the ones that
 * differ: `GET /admin/months/:monthKey/slip-comparison`, `PUT /admin/bills/:id/printed`,
 * `POST /admin/bills/:id/hold` and `/release`, and `409 bills-mismatch` on the publish.
 */
export const SLIP_COMPARISON_ON_SERVER = false;

/**
 * The app's `enableMonthToDate` flag in `PATCH /admin/config`, and `GET /bills/month-to-date`
 * behind it. Until then Configuration → Features neither shows nor sends the flag.
 */
export const MONTH_TO_DATE_ON_SERVER = false;

/**
 * Imports that leave out rows already there (`IMPORT_SKIP_KINDS`): `dryRun` and
 * `duplicates` on `POST /admin/imports/:kind`, and `skipped` in the answer. Until then the
 * import dialog asks for no preview (an API that ignored `dryRun` would save the file) and
 * a supplier code already on the roll still refuses the whole file.
 */
export const IMPORT_SKIP_ON_SERVER = true;
