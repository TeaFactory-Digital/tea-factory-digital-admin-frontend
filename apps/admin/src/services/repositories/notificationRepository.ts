/**
 * M13 gateway.
 *
 * The guard here is doing more work than most in this layer, because a push is the one
 * act in the console that **cannot be taken back and reports nothing when it goes
 * wrong**. A wrong bill is corrected next month; a wrong notification is on three hundred
 * lock screens and the only evidence is the send log. So the schema runs before anything
 * leaves the browser, and it refuses two things the server also refuses:
 *
 *  - a category the app would drop (`unknown-category`), and
 *  - an audience that widens silently: "collection point" with no point named resolves
 *    to *everybody*, which is the one way this module can do real harm.
 */

import {
  EDITORIAL_FALLBACK_LANGUAGE,
  composeNotificationSchema,
  isRecognizedCategory,
  type ComposeNotificationBody,
  type NotificationAudience,
  type NotificationCategory,
  type NotificationQuery,
  type NotificationReach,
  type NotificationSend,
  type NotificationTrigger,
  type Paged,
} from '@tfd/domain';
import {
  notificationEndpoints,
  type SendReceipt,
  type ServedAudience,
  type ServedNotificationSend,
} from '../endpoints/notifications';
import { supplierEndpoints } from '../endpoints/suppliers';
import type { MutationAck } from '../api/adapters';
import { ApiError } from '../api/errors';

/**
 * A log row as the API sends it → the console's `NotificationSend`.
 *
 * The title and body are the fallback language's copy (what the office wrote), from
 * `translations`. The audience is `null` when the API does not send one, and the screen
 * says "not recorded" for it instead of crashing.
 */
function toNotificationSend(row: ServedNotificationSend): NotificationSend {
  const copy =
    row.translations?.find((one) => one.lang === EDITORIAL_FALLBACK_LANGUAGE) ??
    row.translations?.[0];
  return {
    id: row.id,
    category: row.category,
    origin: row.origin,
    title: row.title ?? copy?.title ?? '',
    body: row.body ?? copy?.body ?? '',
    audience: (row.audience as NotificationAudience | null | undefined) ?? null,
    entity: row.entity ?? null,
    entityId: row.entityId ?? null,
    targetedSuppliers: row.targetedSuppliers,
    reachableDevices: row.reachableDevices,
    suppressedDevices: row.suppressedDevices,
    status: row.status,
    createdById: row.createdById ?? null,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    failureReason: row.failureReason ?? null,
  };
}

/**
 * The console's audience → the API's.
 *
 * The API takes `all`, `collectionPoint` (by id), or `suppliers` (a list of ids). A point
 * is sent as itself, so the API filters on each supplier's registered point at send time
 * and the log records the point. A point whose id the console does not have (only its
 * name) is resolved to its suppliers' ids instead, from the suppliers list.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function toServedAudience(audience: NotificationAudience): Promise<ServedAudience> {
  if (audience.kind === 'allSuppliers') return { kind: 'all' };
  if (audience.kind === 'supplier') {
    return { kind: 'suppliers', supplierIds: audience.supplierId ? [audience.supplierId] : [] };
  }
  if (audience.collectionPointId && UUID.test(audience.collectionPointId)) {
    return { kind: 'collectionPoint', collectionPointId: audience.collectionPointId };
  }

  const ids: string[] = [];
  const pageSize = 200;
  for (let page = 0; ; page += 1) {
    const rows = await supplierEndpoints.list({ page, pageSize });
    for (const row of rows.items) {
      if (row.collectionPoint?.name === audience.collectionPoint) ids.push(row.id);
    }
    if (rows.items.length < pageSize || ids.length >= 5000) break;
  }
  return { kind: 'suppliers', supplierIds: ids.slice(0, 5000) };
}

export const notificationRepository = {
  /** Server-paged and server-filtered: see the endpoint; **G-09** is closed here. */
  list: async (query: NotificationQuery = {}): Promise<Paged<NotificationSend>> => {
    const page = await notificationEndpoints.list({ page: 0, pageSize: 25, ...query });
    return { ...page, items: page.items.map(toNotificationSend) };
  },

  triggers: (): Promise<NotificationTrigger[]> => notificationEndpoints.triggers(),

  setTrigger: (category: NotificationCategory, enabled: boolean): Promise<MutationAck> =>
    notificationEndpoints.setTrigger(category, enabled),

  reach: async (
    category: NotificationCategory,
    audience: NotificationAudience,
  ): Promise<NotificationReach> =>
    notificationEndpoints.reach(category, await toServedAudience(audience)),

  /**
   * `async`, so the guard **rejects** rather than throwing synchronously: the defect the
   * content suite caught in `contentRepository`, not repeated here.
   */
  send: async (body: ComposeNotificationBody): Promise<SendReceipt> => {
    // Checked separately from the schema so the *reason* survives. A zod enum failure
    // says "invalid enum value"; this says the app would throw the message away, which is
    // the only sentence that explains why nothing happened.
    if (!isRecognizedCategory(body.category)) {
      throw new ApiError({
        code: 'unknown-category',
        message: 'The app would drop a notification in that category.',
        details: { category: body.category },
      });
    }

    const parsed = composeNotificationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError({
        code: 'invalid',
        message: 'That is not a notification the factory can send.',
        details: parsed.error.flatten(),
      });
    }

    const valid = parsed.data as ComposeNotificationBody;
    return notificationEndpoints.send({
      category: valid.category,
      audience: await toServedAudience(valid.audience),
      // One message, written once, filed as the fallback language: every supplier is
      // shown it whatever their app's language, which is what "the office wrote this" means.
      translations: [
        { lang: EDITORIAL_FALLBACK_LANGUAGE, title: valid.title.trim(), body: valid.body.trim() },
      ],
    });
  },
};
