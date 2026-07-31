/**
 * The domain gateway for the console session.
 *
 * A repository is where a wire response becomes a domain object. Keeping that
 * seam is what absorbs a backend that returns something slightly different from
 * what the UI wants — and it is the layer that gets rewritten when the mock is
 * replaced, with no screen or hook touched (operations.md → Migrating from the
 * mock layer).
 */

import { resolveGrants, type AuthSession, type LoginResult } from '@tfd/domain';
import { authEndpoints } from '../endpoints/auth';

/**
 * Fill in grants the server did not send.
 *
 * The server is authoritative where it speaks; the shipped §12.1 matrix fills
 * the gaps. A backend that has not implemented per-endpoint grants yet still
 * yields a usable console instead of a user who can see nothing.
 */
function hydrate(session: AuthSession): AuthSession {
  return { ...session, grants: resolveGrants(session.user.roles, session.grants) };
}

export const authRepository = {
  login: async (email: string, password: string): Promise<LoginResult> => {
    const result = await authEndpoints.login({ email, password });
    if (result.status === 'authenticated') {
      return { status: 'authenticated', session: hydrate(result.session) };
    }
    return result;
  },

  verifyMfa: async (challengeToken: string, code: string): Promise<AuthSession> =>
    hydrate(await authEndpoints.verifyMfa({ challengeToken, code })),

  refresh: () => authEndpoints.refresh(),

  /**
   * Sign-out never rejects.
   *
   * The local session is cleared either way: a clerk who clicks "Sign out" on a
   * shared office machine and walks away must not be left signed in because the
   * request timed out.
   */
  logout: async (): Promise<void> => {
    try {
      await authEndpoints.logout();
    } catch {
      // Intentionally swallowed — see above.
    }
  },

  me: async () => {
    const { user, grants } = await authEndpoints.me();
    return { user, grants: resolveGrants(user.roles, grants) };
  },
};
