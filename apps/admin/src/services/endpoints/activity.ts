/**
 * The notification bell's feed: what suppliers did that this console user has not seen.
 * The shapes are in `@tfd/domain` (`activity.ts`).
 */

import type { ActivityFeed, ActivityReadMark } from '@tfd/domain';
import { apiClient } from '../api/client';

export const activityEndpoints = {
  feed: (limit: number) =>
    apiClient
      .get<ActivityFeed>('/admin/activity', { params: { limit } })
      .then((response) => response.data),

  /** Everything at or before `upTo` is read, for this user only. */
  markRead: (body: ActivityReadMark) =>
    apiClient
      .post<{ readUpTo: string }>('/admin/activity/read', body)
      .then((response) => response.data),
};
