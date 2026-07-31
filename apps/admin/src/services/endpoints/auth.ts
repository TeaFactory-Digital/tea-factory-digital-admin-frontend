/**
 * Console authentication — a **separate realm** from suppliers.
 *
 * Different table, different token audience, different login screen
 * (admin-console.md → Auth and roles). A supplier token must never open the
 * console, and the console's token carries a factory id and a role set. That is
 * why these paths are `/admin/auth/*` and not the app's `/auth/*`: sharing the
 * path would invite sharing the realm.
 */

import type { AuthSession, CapabilityGrants, ConsoleUser, LoginResult } from '@tfd/domain';
import { apiClient, withoutAuth } from '../api/client';

export interface LoginBody {
  email: string;
  password: string;
}

export interface MfaBody {
  challengeToken: string;
  code: string;
}

export interface RefreshResponse {
  accessToken: string;
  expiresAt: string;
}

export const authEndpoints = {
  /**
   * `200` with a session, or `200` with an MFA challenge — **not** a `401` for
   * the challenge. A password that was correct is not an authentication failure;
   * treating it as one makes rate limiting and lockout counters wrong.
   */
  login: (body: LoginBody) =>
    apiClient
      .post<LoginResult>('/admin/auth/login', body, withoutAuth())
      .then((response) => response.data),

  /** Second factor. Mandatory for manager and above. */
  verifyMfa: (body: MfaBody) =>
    apiClient
      .post<{ session: AuthSession }>('/admin/auth/mfa', body, withoutAuth())
      .then((response) => response.data.session),

  /**
   * Rotating refresh token, read from an httpOnly cookie — never from a body.
   *
   * The console runs on an office machine that other people use; a refresh token
   * in `localStorage` is a token any tab, extension or XSS can read, and it
   * outlives the session by design.
   */
  refresh: () =>
    apiClient
      .post<RefreshResponse>('/admin/auth/refresh', undefined, withoutAuth())
      .then((response) => response.data),

  logout: () => apiClient.post<void>('/admin/auth/logout').then(() => undefined),

  /**
   * Who am I, and what may I do?
   *
   * `grants` is sent explicitly rather than derived from `roles` on the client,
   * because "roles are data, not code" (§12.1) — a factory that splits `clerk`
   * into two roles must not need a console deploy.
   */
  me: () =>
    apiClient
      .get<{ user: ConsoleUser; grants: CapabilityGrants }>('/admin/auth/me')
      .then((response) => response.data),
};
