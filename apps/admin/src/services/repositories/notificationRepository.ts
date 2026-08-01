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
 *  - an audience that widens silently — "collection point" with no point named resolves
 *    to *everybody*, which is the one way this module can do real harm.
 */

import {
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
import { notificationEndpoints } from '../endpoints/notifications';
import { ApiError } from '../api/errors';

export const notificationRepository = {
  list: (query: NotificationQuery = {}): Promise<Paged<NotificationSend>> =>
    notificationEndpoints.list({ page: 0, pageSize: 25, ...query }),

  triggers: (): Promise<NotificationTrigger[]> => notificationEndpoints.triggers(),

  setTrigger: (category: NotificationCategory, enabled: boolean): Promise<NotificationTrigger> =>
    notificationEndpoints.setTrigger(category, enabled),

  reach: (
    category: NotificationCategory,
    audience: NotificationAudience,
  ): Promise<NotificationReach> => notificationEndpoints.reach(category, audience),

  /**
   * `async`, so the guard **rejects** rather than throwing synchronously — the defect the
   * content suite caught in `contentRepository`, not repeated here.
   */
  send: async (body: ComposeNotificationBody): Promise<NotificationSend> => {
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

    return notificationEndpoints.send(parsed.data as ComposeNotificationBody);
  },
};
