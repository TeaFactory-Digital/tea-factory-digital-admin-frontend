/**
 * `GET /config` — the payload that makes the console white-label at runtime.
 *
 * The same endpoint the mobile app calls (white-label.md → Config as an API),
 * with web asset URLs added because the console cannot bundle a per-tenant logo
 * the way a per-brand binary can.
 *
 * **Unauthenticated, and it has to be.** The console needs the factory's name,
 * logo and colours to draw its own sign-in screen; a config behind the token
 * means every factory's login page is identical and grey. Which in turn means
 * this payload must contain nothing sensitive — it is the tenant's public
 * identity, its feature flags and its bank list, and no more.
 */

import type { RuntimeConfig } from '@tfd/domain';
import { apiClient, withoutAuth } from '../api/client';

export const configEndpoints = {
  /**
   * Cached with `ETag` / `If-None-Match`. The browser handles the conditional
   * request; React Query holds the result for the session.
   */
  get: () =>
    apiClient.get<RuntimeConfig>('/config', withoutAuth()).then((response) => response.data),
};
