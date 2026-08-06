/**
 * §21.10's rates — proposed by one person, approved by another.
 *
 * The endpoints mirror M4's monthly rate rather than M14's configuration form, and that is
 * the factory's own answer showing through: they said a change needs a second person, and
 * transport at LKR 2.50/kg against LKR 4.50/kg is a different sum on every account in the
 * factory that nobody would notice for a month.
 *
 * So the capability is `ratesAndMonthClose` — `write` for the accountant who proposes,
 * `approve` for the manager who releases (§12.1) — and not `flagsAndBranding`, which is
 * where the logo lives.
 */

import type { DeductionRateChange, DeductionRates, DeductionRateState } from '@tfd/domain';
import { apiClient } from '../api/client';

export const deductionRateEndpoints = {
  get: () =>
    apiClient.get<DeductionRateState>('/admin/deduction-rates').then((response) => response.data),

  /** `422 note-required` · `422 invalid-rates` · `409 change-pending`. */
  propose: (rates: DeductionRates, reason: string) =>
    apiClient
      .post<DeductionRateChange>('/admin/deduction-rates', { rates, reason })
      .then((response) => response.data),

  /** `409 four-eyes-violation` when the approver proposed it · `409 already-decided`. */
  decide: (id: string, verb: 'approve' | 'reject', note?: string) =>
    apiClient
      .post<DeductionRateChange>(`/admin/deduction-rates/${id}/${verb}`, { note })
      .then((response) => response.data),
};
