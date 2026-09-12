/**
 * Console authentication — a **separate realm** from suppliers.
 *
 * Different table, different token audience, different login screen
 * (admin-console.md → Auth and roles). A supplier token must never open the
 * console, and the console's token carries a factory id and a role set. That is
 * why these paths are `/admin/auth/*` and not the app's `/auth/*`: sharing the
 * path would invite sharing the realm.
 */

import type { CapabilityGrants, LoginResult } from '@tfd/domain';
import { apiClient, withoutAuth } from '../api/client';

interface LoginBody {
  email: string;
  password: string;
}

/**
 * What the session half of `/admin/auth/me` actually carries.
 *
 * The API answers with an identity, not with the `ConsoleUser` record: no `email`, no
 * `status`, no `lastLoginAt` (gap **G-03**). Typed honestly so that nothing downstream
 * reads a field the wire never carried.
 */
export interface MeResponse {
  user: { id: string; name: string; factoryId: string | null; roles: readonly string[] };
  grants: CapabilityGrants;
}

export const authEndpoints = {
  /**
   * `200` with a session, or a `401`. **One step**: the TOTP challenge that used to be a
   * second `200` here is gone, and `POST /admin/auth/mfa` with it.
   */
  login: (body: LoginBody) =>
    apiClient
      .post<LoginResult>('/admin/auth/login', body, withoutAuth())
      .then((response) => response.data),

  /**
   * Rotating refresh token, read from an httpOnly cookie — never from a body.
   *
   * The console runs on an office machine that other people use; a refresh token
   * in `localStorage` is a token any tab, extension or XSS can read, and it
   * outlives the session by design.
   *
   * **It answers with the whole session, not a token pair** — the same `LoginResult`
   * envelope `login` returns, because the API re-resolves grants on every rotation and
   * a rotation is the natural moment to notice that somebody's permissions changed.
   * That is why `authStore.bootstrap()` needs no second call to `/me`: one rotation
   * restores the token, the user and the grant set together.
   *
   * Unwrapped here rather than at the two call sites in `authStore`, so neither has to
   * remember that `.accessToken` lives one level down. Reading it off the envelope
   * yields `undefined`, and an `undefined` access token fails silently: the store holds
   * it, every request goes out with no `Authorization` header, and the console presents
   * as signed in and forbidden from everything.
   */
  refresh: () =>
    apiClient
      .post<LoginResult>('/admin/auth/refresh', undefined, withoutAuth())
      .then((response) => response.data.session),

  logout: () => apiClient.post<void>('/admin/auth/logout').then(() => undefined),

  /**
   * Who am I, and what may I do?
   *
   * `grants` is sent explicitly rather than derived from `roles` on the client,
   * because "roles are data, not code" (§12.1) — a factory that splits `clerk`
   * into two roles must not need a console deploy.
   */
  me: () => apiClient.get<MeResponse>('/admin/auth/me').then((response) => response.data),
};
