/**
 * Factory-record features the API has not built yet (BACKEND-TODO #45).
 *
 * Their routes answer `404`, which the console would show as "That record no longer
 * exists". So they are hidden until the backend confirms each one; remove an entry the day
 * it ships. The mock implements all of them, so tests reach them through the repositories.
 */

import type { ImportKind } from '@tfd/domain';

export const IMPORT_KINDS_NOT_ON_SERVER: ReadonlySet<ImportKind> = new Set<ImportKind>([
  'openingBalances',
  'deliveries',
  'monthlyRates',
  'billAdjustments',
  'bills',
]);

/** Saving opening balances (`PUT /admin/suppliers/:id/opening-balances`). */
export const OPENING_BALANCES_ON_SERVER = false;

/** Typing other deductions on a bill (`PUT /admin/bills/:id/adjustment`). */
export const OTHER_DEDUCTIONS_ON_SERVER = false;
