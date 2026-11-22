import type { ChangeRequestType } from '@tfd/domain';
import type { DecisionVerb } from './hooks';

/**
 * The notes this queue writes all day, by change type and verb. The words live in the
 * string tables, only the choice and order are here.
 *
 * Per type, because a reason only helps when it fits: "Bring passbook" means nothing on
 * an address change, and nothing in this queue carries a photo to call unclear. Approving
 * and rejecting share no vocabulary, so the clerk is never shown a chip for the decision
 * they are not making.
 */
export const SUGGESTIONS: Record<ChangeRequestType, Record<DecisionVerb, readonly string[]>> = {
  address: {
    approve: ['phone', 'collector', 'addressUpdated'],
    reject: ['addressIncomplete', 'outsideArea', 'notConfirmed'],
  },
  bankDetails: {
    approve: ['passbook', 'nameMatches', 'phone'],
    reject: ['mismatch', 'bringPassbook', 'notConfirmed'],
  },
  paymentMethod: {
    approve: ['nextPayout', 'bankOnFile', 'phone'],
    reject: ['noBankAccount', 'notConfirmed', 'visitOffice'],
  },
  savingsRate: {
    approve: ['nextMonth', 'phone'],
    reject: ['outstandingLoan', 'notConfirmed', 'visitOffice'],
  },
};
