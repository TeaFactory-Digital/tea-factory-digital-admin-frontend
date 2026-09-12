/**
 * The tenant for this session, resolved once at module load.
 *
 * The parsing itself lives in `@tfd/brand` as a pure function so it can be
 * tested without a DOM; this module is the thin layer that reads `window` and
 * remembers the answer.
 *
 * Resolved once on purpose. A tenant that could change mid-session would mean
 * every cached query, every open form and the applied theme belong to a factory
 * that is no longer selected — the dev switcher therefore reloads the page
 * rather than mutating this value.
 */

import { apiBaseUrlForTenant, resolveTenant, type TenantResolution } from '@tfd/brand';
import { env } from './env';

/**
 * Whether `?tenant=` is honoured, and therefore whether the switcher is offered.
 *
 * **Development only**, now that the hosted demo build is gone. In production the
 * subdomain is the answer, and a query parameter that repointed a live console at
 * another factory would be a tenant-switch primitive sitting in the URL bar.
 */
const allowTenantOverride = env.isDev;

const resolution: TenantResolution = resolveTenant({
  host: typeof window === 'undefined' ? '' : window.location.hostname,
  search: typeof window === 'undefined' ? '' : window.location.search,
  allowOverride: allowTenantOverride,
  fallback: env.defaultTenant,
});

export const tenantId = resolution.tenantId;

/** The API origin for this tenant, with `{tenant}` substituted. */
export const apiBaseUrl = apiBaseUrlForTenant(env.apiBaseUrlTemplate, tenantId);

