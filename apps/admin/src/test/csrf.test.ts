/**
 * The double-submit CSRF header.
 *
 * The console and the API sit on different subdomains of one site
 * (`galaboda.admin.teafactory.lk` → `api.teafactory.lk`). That split is why
 * `withCredentials` is on, and it is *not* why this header exists: `SameSite` keys on
 * **site**, not origin, so the `Lax` refresh cookie is sent across it anyway. What the
 * header covers is the case `Lax` cannot see — a compromised *sibling* subdomain, which
 * is same-site and could otherwise drive an authenticated refresh.
 *
 * The test that matters most is the third one. `POST /admin/auth/refresh` is sent with
 * `withoutAuth()`, and that flag makes the request interceptor return early — so a CSRF
 * header attached after the early return would reach every request except the single one
 * it was added for, and nothing else in the suite would notice.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { apiClient } from '@/services/api/client';
import { authEndpoints } from '@/services/endpoints/auth';
import { env } from '@/config/env';

/** Headers as the API saw them, captured by a probe handler. */
let seen: Headers | null = null;

function probe(path: string) {
  return [
    http.get(`*${path}`, ({ request }) => {
      seen = request.headers;
      return HttpResponse.json({ ok: true });
    }),
    http.post(`*${path}`, ({ request }) => {
      seen = request.headers;
      return HttpResponse.json({ accessToken: 'a', expiresAt: '2026-01-01T00:00:00.000Z' });
    }),
  ];
}

function setCookie(value: string | null) {
  document.cookie =
    value === null
      ? `${env.csrfCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      : `${env.csrfCookieName}=${value}; path=/`;
}

describe('CSRF header', () => {
  beforeEach(() => {
    seen = null;
    setCookie('tok-abc123');
  });

  afterEach(() => setCookie(null));

  it('echoes the cookie back on a mutation', async () => {
    server.use(...probe('/csrf-probe'));
    await apiClient.post('/csrf-probe', {});
    expect(seen?.get(env.csrfHeaderName)).toBe('tok-abc123');
  });

  it('sends nothing on a read', async () => {
    /**
     * A `GET` cannot change anything, so there is nothing for a forged one to do. Sending
     * the token anyway would put it in more places than it needs to be — including the
     * one request most likely to be logged or cached by something in between.
     */
    server.use(...probe('/csrf-probe'));
    await apiClient.get('/csrf-probe');
    expect(seen?.has(env.csrfHeaderName)).toBe(false);
  });

  it('reaches the refresh call, which is sent without auth', async () => {
    // The regression this file exists for. `withoutAuth()` returns early from the
    // interceptor; the CSRF header has to be set above that return, not below it.
    server.use(...probe('/admin/auth/refresh'));
    await authEndpoints.refresh();

    expect(seen?.get(env.csrfHeaderName)).toBe('tok-abc123');
    // Still no bearer token — that is the whole point of `withoutAuth`, and adding CSRF
    // must not have quietly undone it.
    expect(seen?.has('Authorization')).toBe(false);
  });

  it('sends no header at all when the API has issued no cookie', async () => {
    /**
     * An API that does not use double-submit should see nothing, rather than an empty
     * header it has to decide how to read. Absent and empty are different claims.
     */
    setCookie(null);
    server.use(...probe('/csrf-probe'));
    await apiClient.post('/csrf-probe', {});
    expect(seen?.has(env.csrfHeaderName)).toBe(false);
  });

  it('still sends the idempotency key it always did', async () => {
    // The interceptor was restructured to hoist the method check; this is the check that
    // the hoist did not drop the other thing that depended on it.
    server.use(...probe('/csrf-probe'));
    await apiClient.post('/csrf-probe', {});
    expect(seen?.get('Idempotency-Key')).toBeTruthy();
  });
});
