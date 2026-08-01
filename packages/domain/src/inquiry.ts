/**
 * M10 Inquiries — the two rules the app and the console must agree on.
 *
 * Small on purpose. An inquiry carries no money and no ceiling, so almost nothing
 * about it is derived — but the **status mapping** has to have exactly one
 * implementation, because the console and the supplier's app describe the same
 * record with different vocabularies (see `AdminInquiry`), and a second mapping
 * written on the API side is how a message the office answered shows in the app as
 * still waiting.
 */

import type { InquiryStatus } from './constants';
import type { RequestStatus } from './types/app';

/**
 * A console inquiry state, in the app's three words.
 *
 * `closed` becomes `rejected` because those are the only words the app has, and a
 * message closed unanswered is not one that was answered. The imprecision is real
 * and it is the point of status.md §21.18 — recording it in one function means the
 * answer changes one line rather than every consumer.
 */
export function inquiryStatusForApp(status: InquiryStatus): RequestStatus {
  if (status === 'open') return 'pending';
  return status === 'resolved' ? 'approved' : 'rejected';
}

/**
 * Is this inquiry finished with?
 *
 * Both terminal states, together, because every caller that asks means "may the
 * office still act on this" — and a check written as `status === 'resolved'`
 * silently lets a closed message be replied to.
 */
export function isInquiryClosed(status: InquiryStatus): boolean {
  return status !== 'open';
}
