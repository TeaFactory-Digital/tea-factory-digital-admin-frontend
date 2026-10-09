/**
 * The console's notification bell: what suppliers did that the office has not seen yet.
 *
 * The queues answer "what is waiting"; this answers "what just happened". A supplier
 * who sends a loan request, cancels a tea-packet request, replies to an inquiry or asks
 * for their app account to be deleted appears here once, newest first, with a mark for
 * what this console user has not read.
 *
 * **Supplier actions only.** What the office did is the audit log's; a feed that also
 * listed every approval would bury the one new request under the clerk's own work.
 * **Per user:** a manager reading the bell does not mark it read for the clerk.
 */

import type { ChangeRequestType, CreditFacility } from './types/app';
import type { Capability } from './types/admin';

export const ACTIVITY_KINDS = [
  'creditRequest.created',
  'creditRequest.cancelled',
  'teaPacket.created',
  'teaPacket.cancelled',
  'changeRequest.created',
  'inquiry.created',
  'inquiry.replied',
  'supplier.appDeletionRequested',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** When the supplier did it. */
  at: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  /** The request or inquiry it concerns; the supplier's id for an account event. */
  entityId: string;
  /** Only what the sentence needs. */
  facility?: CreditFacility;
  amount?: number;
  changeType?: ChangeRequestType;
  /** An inquiry's subject. */
  subject?: string;
  /** After this user's read mark. */
  unread: boolean;
}

/** `GET /admin/activity?limit=` */
export interface ActivityFeed {
  items: ActivityItem[];
  /** All unread items for this user, not only those in `items`. */
  unread: number;
  /** This user's read mark, or `null` before they first opened the bell. */
  readUpTo: string | null;
}

/** `POST /admin/activity/read` with `{ upTo }`: everything at or before it is read. */
export interface ActivityReadMark {
  upTo: string;
}

/**
 * Who sees which kind: the same read permission as the screen the item opens. A clerk
 * without the credit queue is not told about loan requests they cannot open.
 */
export const ACTIVITY_CAPABILITY: Record<ActivityKind, Capability> = {
  'creditRequest.created': 'creditRequests',
  'creditRequest.cancelled': 'creditRequests',
  'teaPacket.created': 'creditRequests',
  'teaPacket.cancelled': 'creditRequests',
  'changeRequest.created': 'changeRequests',
  'inquiry.created': 'inquiries',
  'inquiry.replied': 'inquiries',
  'supplier.appDeletionRequested': 'suppliers',
};
