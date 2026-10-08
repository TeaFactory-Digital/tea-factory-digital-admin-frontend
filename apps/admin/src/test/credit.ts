import type { AdminCreditRequest, CreditEligibility } from '@tfd/domain';

/**
 * The figures of a request the test knows to be pending.
 *
 * `eligibility` is `null` once a request is rejected or cancelled, so a bare read is a
 * type error. A pending request always carries it, and a test reading one that does not
 * has picked the wrong fixture: that should fail here, by name, not as a TypeError later.
 */
export function eligibilityOf(
  request: Pick<AdminCreditRequest, 'id' | 'eligibility'>,
): CreditEligibility {
  if (!request.eligibility) throw new Error(`credit request ${request.id} carries no eligibility`);
  return request.eligibility;
}
