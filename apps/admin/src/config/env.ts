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
   * Placeholder default: the backend does not exist yet. Every path the console
   * calls is specified in `docs/api-contract.md`; with `useMock` on, none of
   * them reach the network.
   */
  apiBaseUrlTemplate: String(raw.VITE_API_BASE_URL ?? 'https://api.teafactory.example/v1'),

  /**
   * Serve everything from the in-browser mock.
   *
   * Defaults **on in development, off in production**: a production bundle that
   * silently answered from fixtures would be indistinguishable from a working
   * console, which is the worst possible failure mode for an office that trusts
   * what it sees.
   */
  useMock: bool(raw.VITE_USE_MOCK, Boolean(raw.DEV)),

  /** Tenant used when the host carries no subdomain (localhost). */
  defaultTenant: String(raw.VITE_DEFAULT_TENANT ?? 'base'),

  /**
   * Send `X-Tenant` as well as relying on the subdomain.
   *
   * A routing hint only. The backend must validate it against the token and
   * answer `403` when they disagree — never treat it as a tenant switch.
   */
  sendTenantHeader: bool(raw.VITE_SEND_TENANT_HEADER, true),

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
  if (env.useMock) {
    throw new Error(
      '[config] VITE_USE_MOCK is on in a production build. The console would serve fixtures as if they were the factory’s records.',
    );
  }
  if (env.apiBaseUrlTemplate.includes('teafactory.example')) {
    throw new Error(
      '[config] VITE_API_BASE_URL is still the placeholder origin. Set it to the real API before deploying.',
    );
  }
}
