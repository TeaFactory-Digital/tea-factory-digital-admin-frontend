/**
 * The one axios instance. **Nothing outside `services/api` and
 * `services/endpoints` may import axios** — the lint config enforces it.
 *
 * Two things here are the fixes api.md §17.7 asks for before a real API lands,
 * written in from the start rather than discovered at integration:
 *
 *  1. **Domain codes survive normalisation.** The mobile app's `normalizeError`
 *     sets `code: String(status)`, so a `422` carrying
 *     `{"code": "advance-over-limit"}` reaches the screen as `code: "422"` and
 *     the specific banner never renders. Here the body's code wins.
 *
 *  2. **Token refresh exists.** A `401` triggers exactly one refresh attempt and
 *     one replay. Without it the console's 15-minute access token would drop a
 *     clerk mid-form every quarter hour.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import { apiBaseUrl, tenantId } from '@/config/tenant';
import { ApiError, TRANSPORT_CODES } from './errors';

/**
 * How the transport reaches the session without importing the auth store.
 *
 * The store imports repositories, repositories import endpoints, endpoints
 * import this module — so this module cannot import the store. The store
 * registers itself here at start-up instead.
 */
export interface AuthBridge {
  getAccessToken: () => string | null;
  /** Resolves to a fresh access token, or null when the session is unrecoverable. */
  refresh: () => Promise<string | null>;
  /** Called when refresh fails: clear the session and route to sign-in. */
  onSessionLost: () => void;
}

let authBridge: AuthBridge = {
  getAccessToken: () => null,
  refresh: async () => null,
  onSessionLost: () => {},
};

export function setAuthBridge(bridge: AuthBridge): void {
  authBridge = bridge;
}

/** Requests carrying this flag skip the auth header and the refresh retry. */
const SKIP_AUTH = 'x-skip-auth';

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const apiClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  // Cookies carry the refresh token, and the API is on a different subdomain
  // from the console — so credentials must be sent cross-origin. The backend
  // needs a matching `Access-Control-Allow-Credentials` and an explicit origin
  // allowlist (a wildcard is illegal with credentials).
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (env.sendTenantHeader) {
    config.headers.set('X-Tenant', tenantId);
  }

  if (config.headers.has(SKIP_AUTH)) {
    config.headers.delete(SKIP_AUTH);
    return config;
  }

  const token = authBridge.getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);

  /**
   * Idempotency on every mutation (§17.5).
   *
   * The app's reason is a supplier double-tapping submit on a bad connection;
   * the console's is worse. A clerk who clicks "Approve" twice because the first
   * click seemed not to register must not produce two disbursements, and a
   * retried payout run must not pay twice.
   */
  const method = (config.method ?? 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && !config.headers.has('Idempotency-Key')) {
    config.headers.set('Idempotency-Key', crypto.randomUUID());
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      throw new ApiError({
        code: 'unknown',
        message: error instanceof Error ? error.message : 'Unexpected error',
      });
    }

    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    // One refresh, one replay. `_retried` is what stops a permanently-expired
    // session from looping: the retried request's own 401 falls straight through.
    if (status === 401 && config && !config._retried && !isAuthEndpoint(config.url)) {
      config._retried = true;
      const token = await authBridge.refresh();
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
        return apiClient.request(config);
      }
      authBridge.onSessionLost();
    }

    throw normalizeError(error);
  },
);

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/auth/refresh') || url.includes('/auth/login');
}

/**
 * Wire error → `ApiError`, **preferring the body's domain code**.
 *
 * This is fix #1 from §17.7. The HTTP status is the fallback, not the answer:
 * `403` could be `feature-disabled`, `forbidden` or `four-eyes-violation`, and
 * the console renders three different things for those.
 */
export function normalizeError(error: AxiosError): ApiError {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError({ code: TRANSPORT_CODES.timeout, message: 'The request timed out.' });
  }
  if (axios.isCancel(error)) {
    return new ApiError({ code: TRANSPORT_CODES.cancelled, message: 'Request cancelled.' });
  }
  if (!error.response) {
    return new ApiError({ code: TRANSPORT_CODES.network, message: 'Network unavailable.' });
  }

  const { status, data } = error.response;
  const body = data as { code?: string; message?: string; details?: unknown } | undefined;

  return new ApiError({
    code: body?.code ?? String(status),
    status,
    message: body?.message ?? `Request failed with status ${status}`,
    details: body?.details ?? data,
  });
}

/** Marks a request as pre-auth (login, refresh) so no stale token is attached. */
export function withoutAuth(config: AxiosRequestConfig = {}): AxiosRequestConfig {
  return { ...config, headers: { ...config.headers, [SKIP_AUTH]: '1' } };
}
