/**
 * M13 Notifications — the shared half.
 *
 * Two rules from the contract shape everything here, and both are about **not sending
 * something the app will throw away or the supplier never agreed to**:
 *
 *  1. *"Sends must carry a recognized `data.category` — the app drops anything else
 *     rather than opening an arbitrary screen"* (api-contract.md §17). A category the
 *     app does not know is not a degraded send, it is a **silent** one: the office sees
 *     "sent", the supplier's phone discards it, and nothing anywhere reports a failure.
 *  2. *"Must honour each device's opted-in categories, not only its topic
 *     subscriptions."* A device subscribed to the factory's topic but opted out of
 *     `newsArticle` must not get news. Topic membership is routing; the category list
 *     is consent.
 *
 * Rule 2 is why `partitionDevices` exists rather than a boolean filter: a suppressed
 * device is **counted and reported**, never quietly dropped. "Sent to 240" when 90 of
 * them opted out is a number the office would act on wrongly — and the difference
 * between the two figures is exactly the reach a factory needs to know before it decides
 * whether a circular is worth writing.
 *
 * ---
 *
 * **§21.24 is unanswered, and this module is what makes that survivable.** The factory
 * has not said whether the office composes every send or whether `billPublished` fires
 * off the publish step. Rather than guess, both paths exist and *which triggers fire* is
 * per-tenant data — so the answer, when it comes, is a row in a config table rather than
 * a rewrite. `NOTIFICATION_EVENTS` below is the honest part: it names the console event
 * each category would hang off, which is a fact about the system rather than a policy
 * about the factory.
 */

import type { NotificationCategory, RegisteredDevice } from './types/app';

/**
 * The console event each category would fire from.
 *
 * A fact, not a policy: `billPublished` can only mean the moment a month is published,
 * because that is the moment a bill becomes something a supplier can open. Whether it
 * *does* fire is `NotificationTrigger.enabled`, which is the factory's decision.
 */
export const NOTIFICATION_EVENTS: Record<NotificationCategory, string> = {
  billPublished: 'month.publish',
  requestDecided: 'changeRequest.decide',
  newsArticle: 'news.publish',
  inquiryReplied: 'inquiry.reply',
};

export const NOTIFICATION_CATEGORIES = Object.keys(
  NOTIFICATION_EVENTS,
) as NotificationCategory[];

/**
 * Would the app open this, or drop it?
 *
 * The check exists because a send is **fire-and-forget from the console's point of
 * view**: nothing comes back to say the phone discarded it. A category validated only on
 * the way in is the last chance to notice.
 */
export function isRecognizedCategory(category: string): category is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as string[]).includes(category);
}

/** Who a send is aimed at. */
export type NotificationAudienceKind = 'allSuppliers' | 'collectionPoint' | 'supplier';

export interface NotificationAudience {
  kind: NotificationAudienceKind;
  /** Required when `kind` is `collectionPoint`. */
  collectionPoint?: string;
  /** Required when `kind` is `supplier`. */
  supplierId?: string;
}

/** The supplier facts an audience is resolved against. Deliberately minimal. */
export interface AudienceCandidate {
  id: string;
  collectionPoint: string;
  status: 'active' | 'suspended' | 'closed';
}

/**
 * Is this supplier in the audience?
 *
 * **A closed supplier is never in one**, whatever the audience says. They have left, and
 * a factory circular arriving on the phone of somebody who stopped supplying two years
 * ago is the kind of thing that gets an app uninstalled. A *suspended* supplier is still
 * a supplier — they are mid-dispute, which is precisely when they need to hear from the
 * office — so they stay in.
 */
export function audienceMatches(
  supplier: AudienceCandidate,
  audience: NotificationAudience,
): boolean {
  if (supplier.status === 'closed') return false;

  switch (audience.kind) {
    case 'allSuppliers':
      return true;
    case 'collectionPoint':
      return supplier.collectionPoint === audience.collectionPoint;
    case 'supplier':
      return supplier.id === audience.supplierId;
    default:
      return false;
  }
}

/** Devices that will receive a category, and devices whose owner opted out of it. */
export interface DevicePartition {
  reachable: RegisteredDevice[];
  /** Registered, subscribed, and **opted out of this category**. Counted, not hidden. */
  suppressed: RegisteredDevice[];
}

/**
 * Split devices by consent, honouring the per-device category list (contract rule 2).
 *
 * Returning both halves rather than filtering is the whole point. A console that
 * reported only the reachable count would tell the office a circular reached everybody
 * when a third of the factory had turned that category off — and the office would draw
 * the wrong conclusion about whether the app is worth using, which is the KPI §19.3 says
 * justifies the project.
 */
export function partitionDevices(
  devices: readonly RegisteredDevice[],
  category: NotificationCategory,
): DevicePartition {
  const reachable: RegisteredDevice[] = [];
  const suppressed: RegisteredDevice[] = [];

  for (const device of devices) {
    if (device.categories.includes(category)) reachable.push(device);
    else suppressed.push(device);
  }

  return { reachable, suppressed };
}

/**
 * A one-line description of an audience, for a confirmation dialog.
 *
 * Returns a key and its parameters rather than a sentence — the console localizes
 * (BR-110), and this is shared with an API that has no string table at all.
 */
export function describeAudience(audience: NotificationAudience): {
  key: string;
  params: Record<string, string>;
} {
  switch (audience.kind) {
    case 'collectionPoint':
      return {
        key: 'notifications.audience.collectionPoint',
        params: { point: audience.collectionPoint ?? '' },
      };
    case 'supplier':
      return { key: 'notifications.audience.supplier', params: {} };
    default:
      return { key: 'notifications.audience.allSuppliers', params: {} };
  }
}
