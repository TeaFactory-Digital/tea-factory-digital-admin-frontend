/**
 * M4 gateway for §21.10's rates.
 *
 * The guard is `deductionRateProblems`, shared with the server: a share above 1 takes more
 * than the account earned, which reaches a payout run as a negative line — the one thing
 * `computeBillAmounts` has a whole branch to avoid.
 */

import {
  deductionRateProblems,
  type DeductionRateChange,
  type DeductionRates,
  type DeductionRateState,
} from '@tfd/domain';
import { deductionRateEndpoints } from '../endpoints/deductionRates';
import { ApiError } from '../api/errors';

export const deductionRateRepository = {
  get: (): Promise<DeductionRateState> => deductionRateEndpoints.get(),

  propose: async (rates: DeductionRates, reason: string): Promise<DeductionRateChange> => {
    const problems = deductionRateProblems(rates);
    if (problems.length > 0) {
      throw new ApiError({
        code: 'invalid-rates',
        message: 'Those rates could not be applied to an account.',
        details: { problems },
      });
    }
    return deductionRateEndpoints.propose(rates, reason);
  },

  decide: (id: string, verb: 'approve' | 'reject', note?: string): Promise<DeductionRateChange> =>
    deductionRateEndpoints.decide(id, verb, note),
};
