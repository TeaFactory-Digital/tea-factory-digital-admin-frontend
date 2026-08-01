/**
 * M13 Notifications — the only thing the console does that it gets no acknowledgement
 * for.
 *
 * Everything about this module's shape follows from that. A push leaves and nothing comes
 * back: no phone reports that it dropped the message, no supplier reports that they had
 * the category switched off. So the console cannot verify a send after the fact, and the
 * design compensates **before** it:
 *
 *  - `reach` is its own endpoint, called before the confirmation, because the numbers are
 *    the decision. A circular reaching 40 of 300 suppliers belongs on the noticeboard,
 *    and there is no way to learn that afterwards.
 *  - Every send is a **record** with its counts, not a fire-and-forget — the same reason
 *    a payout run is a record rather than a bank file.
 *  - `unknown-category` is a refusal rather than a warning. The app *drops* a push whose
 *    category it does not recognize, so a send the console called successful would reach
 *    nobody and report nothing.
 *
 * **§21.24 is still unanswered** — whether the office composes every send or whether
 * `billPublished` fires off the publish step. Both paths are here, and the triggers are
 * data: `PUT /triggers/{category}` is how a factory answers the question without a
 * deploy. What is *not* guessed is which console event each category hangs off, because
 * that is a fact about the system rather than a policy about the factory.
 */

import type {
  ComposeNotificationBody,
  NotificationAudience,
  NotificationCategory,
  NotificationQuery,
  NotificationReach,
  NotificationSend,
  NotificationTrigger,
  Paged,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const notificationEndpoints = {
  /** The send log, newest first. Automatic and composed sends in one list. */
  list: (query: NotificationQuery = {}) =>
    apiClient
      .get<Paged<NotificationSend>>('/admin/notifications', { params: toParams(query) })
      .then((response) => response.data),

  /**
   * What this factory fires automatically.
   *
   * `available: false` on a category the tenant's `push.categories` does not carry, so
   * the console can say "not configured for this factory" rather than offering a toggle
   * that would answer `category-disabled`. Configuring it is M14's job.
   */
  triggers: () =>
    apiClient
      .get<NotificationTrigger[]>('/admin/notifications/triggers')
      .then((response) => response.data),

  /** `409 category-disabled` for a category this tenant does not send. */
  setTrigger: (category: NotificationCategory, enabled: boolean) =>
    apiClient
      .put<NotificationTrigger>(`/admin/notifications/triggers/${category}`, { enabled })
      .then((response) => response.data),

  /**
   * How far a send would reach, before anybody presses send.
   *
   * A `POST` despite being a read, because the audience is a structured body rather than
   * a query string — and because the alternative is encoding a supplier id into a URL
   * that would then be cached.
   */
  reach: (category: NotificationCategory, audience: NotificationAudience) =>
    apiClient
      .post<NotificationReach>('/admin/notifications/reach', { category, audience })
      .then((response) => response.data),

  /**
   * Send one, composed by a person.
   *
   * `422 unknown-category` · `409 category-disabled` · `409 no-recipients` ·
   * `409 push-not-configured` when the tenant has the flag on and no push block.
   */
  send: (body: ComposeNotificationBody) =>
    apiClient
      .post<NotificationSend>('/admin/notifications', body)
      .then((response) => response.data),
};
