/**
 * Build-time environment, read once and validated once.
 *
 * Every value here is compiled into the bundle and readable by anyone with the
 * URL. That is fine — all of it is configuration. **Nothing secret may be added
 * to this file**, and there is no mechanism to keep one here.
 *
 * Note what is *not* here: the factory's name, colours, flags, bank list or
 * savings options. One bundle serves every tenant, so all of that is runtime
 * config from `GET /config` (see `RuntimeConfigProvider`). If you find yourself
 * wanting a `VITE_FACTORY_NAME`, the answer is the served config.
 */

const raw = import.meta.env;

/** `"1"`, `"true"`, `"yes"` → true. Anything else, including absent → false. */
function bool(value: unknown, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes)$/i.test(String(value));
}

function int(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  /**
   * API origin template. `{tenant}` is substituted per tenant.
   *
   * The placeholder default is retained as a **tripwire**, not as a fallback: it is a
   * domain nobody owns, and `assertEnvUsable` refuses to boot a production bundle still
   * pointed at it. Development points at the local API (`.env.development`).
   *
   * There is no `useMock` and no `demoMode` beside it any more. The in-browser mock is
   * gone — the fixtures answer Vitest and nothing else — so there is no longer a switch
   * that makes a running console serve fiction, which is the one failure mode an office
   * cannot see.
   */
  apiBaseUrlTemplate: String(raw.VITE_API_BASE_URL ?? 'https://api.teafactory.example/v1'),

  /** Tenant used when the host carries no subdomain (localhost). */
  defaultTenant: String(raw.VITE_DEFAULT_TENANT ?? 'base'),

  /**
   * Send `X-Tenant` as well as relying on the subdomain.
   *
   * A routing hint only. The backend must validate it against the token and
   * answer `403` when they disagree — never treat it as a tenant switch.
   */
  sendTenantHeader: bool(raw.VITE_SEND_TENANT_HEADER, true),

  /**
   * Double-submit CSRF: the cookie the API sets, echoed back in a header.
   *
   * The console and the API sit on different subdomains of one site
   * (`galaboda.admin.teafactory.lk` → `api.teafactory.lk`, operations.md →
   * Deployment). `SameSite=Lax` keys on **site**, not origin, so the refresh cookie
   * is still sent on that cross-origin `POST` — refresh is not broken by the split,
   * and this header is not what makes it work.
   *
   * What it defends is the case Lax cannot see: a *sibling* subdomain. Anything on
   * `*.teafactory.lk` is same-site, so a compromised one could drive an authenticated
   * refresh. Echoing a cookie value the attacker's origin cannot read closes that.
   *
   * Set `VITE_CSRF_COOKIE=` (empty) to switch it off — for an API that does not issue
   * the cookie, where sending a header from an absent cookie would be noise.
   */
  csrfCookieName: String(raw.VITE_CSRF_COOKIE ?? 'tfd_csrf'),
  csrfHeaderName: String(raw.VITE_CSRF_HEADER ?? 'X-CSRF-Token'),

  apiTimeoutMs: int(raw.VITE_API_TIMEOUT_MS, 20000),

  isDev: Boolean(raw.DEV),
  isProd: Boolean(raw.PROD),
} as const;

/**
 * Refuse to start a production bundle that is wired to the placeholder origin.
 *
 * The failure this prevents: shipping a console that looks fine, fails every
 * request against a domain nobody owns, and reports it as a network problem.
 */
export function assertEnvUsable(): void {
  if (!env.isProd) return;

  if (env.apiBaseUrlTemplate.includes('teafactory.example')) {
    throw new Error(
      '[config] VITE_API_BASE_URL is still the placeholder origin. Set it to the real API before deploying.',
    );
  }
}
