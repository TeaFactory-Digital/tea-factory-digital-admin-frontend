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

const resolution: TenantResolution = resolveTenant({
  host: typeof window === 'undefined' ? '' : window.location.hostname,
  search: typeof window === 'undefined' ? '' : window.location.search,
  // The `?tenant=` override is a development affordance only. In production the
  // subdomain is the answer, and a query parameter that repointed a live console
  // at another factory would be a tenant-switch primitive in the URL bar.
  allowOverride: env.isDev,
  fallback: env.defaultTenant,
});

export const tenantId = resolution.tenantId;
export const tenantSource = resolution.source;

/** The API origin for this tenant, with `{tenant}` substituted. */
export const apiBaseUrl = apiBaseUrlForTenant(env.apiBaseUrlTemplate, tenantId);

/**
 * Switch tenant in development by reloading with `?tenant=`.
 *
 * A full reload, not a state update: see above. It also mirrors what actually
 * happens in production, where switching tenant means navigating to a different
 * subdomain and getting a fresh document.
 */
export function switchTenantForDevelopment(next: string): void {
  if (!env.isDev) return;
  const url = new URL(window.location.href);
  url.searchParams.set('tenant', next);
  window.location.assign(url.toString());
}
