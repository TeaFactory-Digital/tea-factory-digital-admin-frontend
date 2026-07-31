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
 * Development and the hosted demo, never a real deployment. In production the
 * subdomain is the answer, and a query parameter that repointed a live console at
 * another factory would be a tenant-switch primitive sitting in the URL bar.
 *
 * The demo is exempt because there is nothing there to repoint *to*: every tenant
 * is a fixture in `mocks/seed.ts`, so the override reaches invented factories only.
 * It is also the entire point of a demo of a white-label product — a console that
 * cannot be shown rebranding is not showing the feature.
 */
export const allowTenantOverride = env.isDev || env.demoMode;

const resolution: TenantResolution = resolveTenant({
  host: typeof window === 'undefined' ? '' : window.location.hostname,
  search: typeof window === 'undefined' ? '' : window.location.search,
  allowOverride: allowTenantOverride,
  fallback: env.defaultTenant,
});

export const tenantId = resolution.tenantId;
export const tenantSource = resolution.source;

/** The API origin for this tenant, with `{tenant}` substituted. */
export const apiBaseUrl = apiBaseUrlForTenant(env.apiBaseUrlTemplate, tenantId);

/**
 * Switch tenant by reloading with `?tenant=`. Development and the demo only.
 *
 * A full reload, not a state update: see above. It also mirrors what actually
 * happens in production, where switching tenant means navigating to a different
 * subdomain and getting a fresh document.
 */
export function switchTenantByReload(next: string): void {
  if (!allowTenantOverride) return;
  const url = new URL(window.location.href);
  url.searchParams.set('tenant', next);
  window.location.assign(url.toString());
}
