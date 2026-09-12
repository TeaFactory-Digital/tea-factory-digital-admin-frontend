/**
 * The domain gateway for the console session.
 *
 * A repository is where a wire response becomes a domain object. Keeping that
 * seam is what absorbs a backend that returns something slightly different from
 * what the UI wants — and it is the layer that gets rewritten when the mock is
 * replaced, with no screen or hook touched (operations.md → Migrating from the
 * mock layer).
 */

import { resolveGrants, type AuthSession, type CapabilityGrants, type ConsoleRole } from '@tfd/domain';
import { authEndpoints, type MeResponse } from '../endpoints/auth';

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
  login: async (email: string, password: string): Promise<AuthSession> => {
    const result = await authEndpoints.login({ email, password });
    return hydrate(result.session);
  },

  /**
   * Rotate, and take the whole session back.
   *
   * Hydrated like `login` is, and for the same reason: the grants the API sends are
   * authoritative where it speaks, and the shipped §12.1 matrix fills what it leaves out.
   * A rotation that returned an un-hydrated session would quietly narrow a clerk's
   * console fifteen minutes after they signed in, which is the hardest kind of permission
   * bug to reproduce.
   */
  refresh: async (): Promise<AuthSession> => hydrate(await authEndpoints.refresh()),

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

  /**
   * The session as the API describes it, without rotating anything.
   *
   * **Not used on bootstrap** — `refresh` above already answers with the user and the
   * grants, so asking again would be a second round trip for a payload the console is
   * already holding. It is kept because it is the only way to re-read grants *without*
   * spending a refresh token, and because `roles` is all it needs from the thin identity
   * the endpoint returns (gap **G-03**).
   */
  me: async (): Promise<{ user: MeResponse['user']; grants: CapabilityGrants }> => {
    const { user, grants } = await authEndpoints.me();
    return { user, grants: resolveGrants(user.roles as ConsoleRole[], grants) };
  },
};
