/**
 * M14 Configuration — the authenticated other end of `GET /config`.
 *
 * **Two endpoints for one row, and the split is the point.** The public `GET /config`
 * (`endpoints/config.ts`) is unauthenticated because the console has to draw a branded
 * sign-in screen before anybody has a token — which means it may only ever carry the
 * tenant's public identity. This one requires `flagsAndBranding` and carries the same row
 * plus the thing an editor cannot work without: **what a change would cost.**
 *
 * `usage` is fetched with the config rather than computed by the console, because the
 * counts it holds are queries over records the console does not have — how many suppliers
 * hold a savings balance, how many delivery rows name a collection point. A console that
 * guessed would warn about the wrong things, and the API would then refuse on something
 * else entirely.
 */

import type { ConfigPatch, ConfigUsage, RuntimeConfig } from '@tfd/domain';
import { apiClient } from '../api/client';

export interface AdminConfigResponse {
  config: RuntimeConfig;
  usage: ConfigUsage;
}

export const adminConfigEndpoints = {
  get: () =>
    apiClient.get<AdminConfigResponse>('/admin/config').then((response) => response.data),

  /**
   * A `PATCH` of whole sections, never a `PUT` of the row.
   *
   * Two administrators editing different sections is the normal case in an office with a
   * factory admin and a platform admin, and a whole-row `PUT` means whoever saves second
   * silently reverts the other's section. The body carries only what changed, and the audit
   * entry records only that.
   *
   * ```
   * 409 tenant-immutable           `tenantId` in the body — it comes from the subdomain
   * 409 flag-has-records           turning off a feature that is holding money
   * 409 point-in-use               removing a collection point with deliveries filed to it
   * 422 fallback-language-required dropping English, which every content fallback needs
   * ```
   */
  patch: (patch: ConfigPatch) =>
    apiClient.patch<AdminConfigResponse>('/admin/config', patch).then((response) => response.data),
};
