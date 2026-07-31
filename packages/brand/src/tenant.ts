/**
 * Which factory is this console showing?
 *
 * Production answers with the subdomain. Development has no subdomain, so it
 * answers with an explicit override. Kept pure — `host` and `search` come in as
 * strings, so this is testable without a DOM and cannot accidentally read
 * `window` during SSR or a unit test.
 *
 * **The subdomain is a routing hint, never an authorization decision.** The
 * authoritative tenant is the one inside the access token; a session whose token
 * disagrees with the host is a `403`, not a tenant switch (white-label.md →
 * Where the tenant comes from). Get that wrong on the backend and every tenant
 * can read every other tenant's suppliers by editing a hostname.
 */

/** Hosts that carry no tenant information. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

/**
 * Platform domains where the leading label is a *deployment* name, not a factory.
 *
 * `tfd-admin-git-main-acme.vercel.app` is one console, not a factory called
 * "tfd-admin-git-main-acme". Without this the label parses as a tenant id, the
 * served config answers `404 tenant-unknown`, and a preview deployment boots
 * unbranded behind a "could not reach the factory configuration" banner —
 * indistinguishable from the API being down.
 *
 * A tenant on one of these domains has to come from the configured fallback, so
 * a real per-tenant deployment needs a real wildcard domain (operations.md →
 * Deployment). That is the intended asymmetry: preview hosting is not
 * multi-tenant hosting.
 */
const PLATFORM_DOMAINS = ['vercel.app', 'netlify.app', 'pages.dev', 'github.io'];

/** Subdomains that are infrastructure, not factories. */
const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api', 'app', 'staging', 'preview']);

const TENANT_ID = /^[a-z0-9][a-z0-9-]{1,30}$/;

export interface ResolveTenantOptions {
  /** `window.location.hostname`. */
  host: string;
  /** `window.location.search`, for the dev-only `?tenant=` override. */
  search?: string;
  /**
   * Whether the `?tenant=` override is honoured. Pass `import.meta.env.DEV`.
   *
   * Off in production on purpose: a query parameter that repointed a live
   * console at another factory would be a tenant-switch primitive handed to
   * anyone with a URL bar. The token still governs, but the request would be
   * routed and themed as someone else, which is confusing at best.
   */
  allowOverride: boolean;
  /** Used when nothing else resolves. */
  fallback?: string;
}

export interface TenantResolution {
  tenantId: string;
  /** How we got it — surfaced in the dev tenant switcher and in support logs. */
  source: 'subdomain' | 'override' | 'fallback';
}

export function resolveTenant(options: ResolveTenantOptions): TenantResolution {
  const { host, search = '', allowOverride, fallback = 'base' } = options;

  if (allowOverride) {
    const override = new URLSearchParams(search).get('tenant')?.trim().toLowerCase();
    if (override && TENANT_ID.test(override)) {
      return { tenantId: override, source: 'override' };
    }
  }

  const fromHost = tenantIdFromHost(host);
  if (fromHost) return { tenantId: fromHost, source: 'subdomain' };

  return { tenantId: fallback, source: 'fallback' };
}

/**
 * `galaboda.admin.teafactory.lk` → `galaboda`.
 *
 * Returns `null` for a local host, an IP address, a preview-hosting domain, or a
 * leading label that is infrastructure rather than a factory —
 * `admin.teafactory.lk` is the bare deployment, not a tenant called "admin".
 */
export function tenantIdFromHost(host: string): string | null {
  const hostname = host.trim().toLowerCase().split(':')[0] ?? '';
  if (!hostname || LOCAL_HOSTS.has(hostname)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
  if (PLATFORM_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return null;
  }

  const labels = hostname.split('.');
  if (labels.length < 3) return null;

  const first = labels[0];
  if (!first || RESERVED_SUBDOMAINS.has(first) || !TENANT_ID.test(first)) return null;

  return first;
}

/**
 * The API origin for a tenant.
 *
 * `white-label.md` recommends **subdomain for the console, header for the app**,
 * and keeping a per-tenant base URL anyway because "it costs nothing, and it is
 * the escape hatch that lets one factory be moved to its own deployment later".
 * A `{tenant}` placeholder in the configured base URL is that escape hatch: set
 * it to a fixed origin and every tenant shares one deployment; leave the
 * placeholder and each resolves its own.
 */
export function apiBaseUrlForTenant(template: string, tenantId: string): string {
  return template.replace(/\{tenant\}/g, tenantId);
}
