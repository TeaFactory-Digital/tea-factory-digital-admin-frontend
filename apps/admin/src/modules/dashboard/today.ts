/**
 * "Your work today" (24 November 2026): the queues this user can act on, as a short list of
 * what to do next, overdue first. The queue cards below say how big each queue is; this says
 * where to start. Pure, so the order is tested without a DOM.
 */

import type { QueueCount } from '@tfd/domain';
import { NAVIGATION, queuesOf, type NavItem } from '@/layout/navigation';

export type TodayItem =
  | { kind: 'overdue'; queue: QueueCount; count: number }
  | { kind: 'assigned'; count: number }
  | { kind: 'waiting'; queue: QueueCount; count: number };

/** The most rows shown; the queue cards below carry the rest. */
export const TODAY_LIMIT = 5;

/**
 * Overdue first (most past target first), then what is assigned to this user, then what
 * is waiting (oldest first). A queue appears at most twice: its overdue requests, and the
 * rest of it, so a request is never counted twice.
 */
export function todayItems(
  queues: QueueCount[],
  canAct: (queue: QueueCount) => boolean,
  assignedToMe = 0,
): TodayItem[] {
  const mine = queues.filter((one) => one.pending > 0 && canAct(one));

  const overdue = mine
    .filter((one) => one.breachingSla > 0)
    .sort((a, b) => b.breachingSla - a.breachingSla)
    .map((queue) => ({ kind: 'overdue' as const, queue, count: queue.breachingSla }));

  const waiting = mine
    .filter((one) => one.pending - one.breachingSla > 0)
    .sort((a, b) => (a.oldestPendingAt ?? '').localeCompare(b.oldestPendingAt ?? ''))
    .map((queue) => ({ kind: 'waiting' as const, queue, count: queue.pending - queue.breachingSla }));

  return [
    ...overdue,
    ...(assignedToMe > 0 ? [{ kind: 'assigned' as const, count: assignedToMe }] : []),
    ...waiting,
  ];
}

/* ── Where a queue opens ─────────────────────────────────────────────────── */


const QUEUE_FACILITY: Partial<Record<QueueCount['queue'], string>> = {
  advanceRequests: 'advance',
  loanRequests: 'loan',
  manureRequests: 'manure',
};

/** The sidebar row a queue lives behind: the one source of where it opens. */
export function queueNavItem(queue: QueueCount['queue']): NavItem | undefined {
  return NAVIGATION.flatMap((section) => section.items).find((item) => queuesOf(item).includes(queue));
}

/** The queue's screen, narrowed to what is pending (and to its facility, for credit). */
export function queueLink(queue: QueueCount['queue']): string | undefined {
  const item = queueNavItem(queue);
  if (!item) return undefined;
  const search = new URLSearchParams({ status: 'pending' });
  const facility = QUEUE_FACILITY[queue];
  if (facility) search.set('facility', facility);
  return `${item.to}?${search}`;
}
