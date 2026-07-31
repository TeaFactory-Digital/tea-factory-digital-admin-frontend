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

  /**
   * This bundle is a **demo**: it is allowed to answer from fixtures even though
   * it is a production build.
   *
   * Built by `npm run build:demo` (`--mode demo`, see `.env.demo`) so the console
   * can be hosted and clicked through before the backend exists.
   *
   * Read from the build **mode**, not from a `VITE_*` variable, and that is the
   * whole point: a demo is a different build artefact, not the real bundle with a
   * variable flipped. No environment variable set in a hosting dashboard can turn
   * a production console into a fiction — someone has to run a different build
   * command.
   *
   * What keeps it honest at runtime is that nothing is hidden: the mock banner in
   * `AppShell` and the printed credentials on the sign-in screen are both keyed
   * off `useMock`, so a demo build says so on every screen.
   */
  demoMode: raw.MODE === 'demo',

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

  /**
   * A demo build is exempt from the placeholder-origin check — the mock answers
   * every request, so no origin is reached — but not from having to be coherent.
   * Demo mode with the mock off is the exact failure the check below exists for,
   * dressed up as intentional.
   */
  if (env.demoMode) {
    if (!env.useMock) {
      throw new Error(
        '[config] VITE_DEMO_MODE is on but VITE_USE_MOCK is off. A demo build with no mock reaches the network for every request.',
      );
    }
    return;
  }

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
