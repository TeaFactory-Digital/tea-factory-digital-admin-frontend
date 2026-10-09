/**
 * The notification bell's feed.
 *
 * `null` while the server has no feed (`404`, BACKEND-TODO #46): the bell still shows the
 * waiting queues, and says the activity list is not available rather than that nothing
 * happened.
 */

import type { ActivityFeed } from '@tfd/domain';
import { ApiError } from '../api/errors';
import { activityEndpoints } from '../endpoints/activity';

export const activityRepository = {
  feed: async (limit = 20): Promise<ActivityFeed | null> => {
    try {
      return await activityEndpoints.feed(limit);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.code === 'not-found')) return null;
      throw error;
    }
  },

  markRead: (upTo: string) => activityEndpoints.markRead({ upTo }),
};
