/**
 * One supplier's history as a single list (24 November 2026): bills, credit and tea packet
 * requests, change requests and inquiries, newest first, each linking to its own screen.
 *
 * The counter answers "what happened with my account" without walking four screens. Built
 * here from the lists the console already reads, so it needs nothing new from the API, and
 * pure, so the order and the grouping are tested without a DOM.
 */

import type {
  AdminChangeRequest,
  AdminCreditRequest,
  AdminInquiry,
  AdminTeaPacketRequest,
  InquiryStatus,
  RequestStatus,
  SupplierMonthSummary,
} from '@tfd/domain';

export type TimelineKind = 'bill' | 'request' | 'change' | 'inquiry';

export type TimelineTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export type TimelineEvent =
  | { kind: 'bill'; id: string; at: string; month: SupplierMonthSummary }
  | { kind: 'request'; id: string; at: string; credit: AdminCreditRequest }
  | { kind: 'request'; id: string; at: string; teaPacket: AdminTeaPacketRequest }
  | { kind: 'change'; id: string; at: string; change: AdminChangeRequest }
  | { kind: 'inquiry'; id: string; at: string; inquiry: AdminInquiry };

export const REQUEST_TONES: Record<RequestStatus, TimelineTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

export const INQUIRY_TONES: Record<InquiryStatus, TimelineTone> = {
  open: 'warning',
  escalated: 'error',
  awaitingSupplier: 'info',
  resolved: 'success',
  closed: 'neutral',
};

/**
 * Where a month's bill sits in time: the first moment of the next month, when the office
 * starts closing it. The summary carries no date of its own, and the screen shows the month,
 * never this instant, so nothing reads as a time it is not.
 */
export function billMoment(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  return `${next}-01T00:00:00.000Z`;
}

export interface TimelineSources {
  supplierId: string;
  months?: SupplierMonthSummary[];
  credit?: AdminCreditRequest[];
  teaPackets?: AdminTeaPacketRequest[];
  changes?: AdminChangeRequest[];
  inquiries?: AdminInquiry[];
}

/**
 * Every event, newest first. Rows for another supplier are dropped: some lists have
 * ignored the `supplierId` filter (BACKEND-TODO #28), and a stranger's request on this
 * record would be worse than a missing one. A month without leaf is not an event.
 */
export function buildTimeline(sources: TimelineSources): TimelineEvent[] {
  const own = <T extends { supplierId: string }>(rows: T[] | undefined) =>
    (rows ?? []).filter((row) => row.supplierId === sources.supplierId);
  const events: TimelineEvent[] = [
    ...(sources.months ?? [])
      .filter((month) => month.totalKgs > 0 || month.billId)
      .map((month) => ({
        kind: 'bill' as const,
        id: `bill-${month.monthKey}`,
        at: billMoment(month.monthKey),
        month,
      })),
    ...own(sources.credit).map((credit) => ({
      kind: 'request' as const,
      id: `credit-${credit.id}`,
      at: credit.createdAt,
      credit,
    })),
    ...own(sources.teaPackets).map((teaPacket) => ({
      kind: 'request' as const,
      id: `tea-${teaPacket.id}`,
      at: teaPacket.createdAt,
      teaPacket,
    })),
    ...own(sources.changes).map((change) => ({
      kind: 'change' as const,
      id: `change-${change.id}`,
      at: change.createdAt,
      change,
    })),
    ...own(sources.inquiries).map((inquiry) => ({
      kind: 'inquiry' as const,
      id: `inquiry-${inquiry.id}`,
      at: inquiry.createdAt,
      inquiry,
    })),
  ];
  // The same row can arrive twice from two status pages; one id, one event.
  const seen = new Set<string>();
  return events
    .filter((event) => (seen.has(event.id) ? false : (seen.add(event.id), true)))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** The month an event belongs to, for the headings: `2026-11`. */
export function eventMonthKey(event: TimelineEvent): string {
  return event.kind === 'bill' ? event.month.monthKey : event.at.slice(0, 7);
}

/** Consecutive events grouped under their month, newest month first. */
export function groupByMonth(events: TimelineEvent[]): { monthKey: string; events: TimelineEvent[] }[] {
  const groups: { monthKey: string; events: TimelineEvent[] }[] = [];
  for (const event of events) {
    const key = eventMonthKey(event);
    const last = groups[groups.length - 1];
    if (last && last.monthKey === key) last.events.push(event);
    else groups.push({ monthKey: key, events: [event] });
  }
  return groups;
}
