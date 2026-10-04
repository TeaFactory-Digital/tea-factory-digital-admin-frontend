import type { AdminInquiry } from '@tfd/domain';

/**
 * May the office still write on this?
 *
 * Open, always. Answered too, but only on an API that keeps a conversation
 * (`threaded`): one with a single answer column refuses a second reply, and offering
 * the button would be offering a refusal.
 */
export function isAnswerable(inquiry: AdminInquiry): boolean {
  return inquiry.status === 'open' || (inquiry.status === 'resolved' && inquiry.threaded === true);
}
