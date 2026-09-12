/**
 * The console session.
 *
 * **The access token lives in memory only.** Not `localStorage`, not
 * `sessionStorage`: the console runs on a shared office machine, and a token in
 * web storage is readable by any script on the origin and outlives the tab. The
 * refresh token is an httpOnly cookie the JS never sees, which is what makes
 * surviving a page reload possible without storing anything readable.
 *
 * That choice is why `bootstrap()` exists: on a fresh document there is no access
 * token, so the store asks for a refresh first and only then asks who it is.
 */

import { create } from 'zustand';
import type { AuthSession, CapabilityGrants, ConsoleUser } from '@tfd/domain';
import { can as canDo, type AccessLevel, type Capability } from '@tfd/domain';
import { authRepository } from '@/services/repositories/authRepository';
import { setAuthBridge } from '@/services/api/client';

/**
 * No `mfaRequired` between `anonymous` and `authenticated` any more: the second factor
 * the console asked manager-and-above for has been withdrawn (see `LoginResult`), so a
 * correct password moves the store straight to a session.
 */
type AuthStatus = 'bootstrapping' | 'anonymous' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: ConsoleUser | null;
  grants: CapabilityGrants;
  accessToken: string | null;
  expiresAt: string | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthStatus>;
  logout: () => Promise<void>;
  /** Used by the transport's 401 handler. Returns a fresh token, or null. */
  refresh: () => Promise<string | null>;
  clear: () => void;
}

/**
 * The rotation in flight, if any — **one at a time, shared by every caller.**
 *
 * The refresh token is **single-use**: the API rotates it on every call and treats a
 * second presentation of a spent one as *reuse*, which revokes the whole family. So two
 * concurrent rotations do not merely waste a round trip, they sign the clerk out.
 *
 * There are two ways to get two. `App` calls `bootstrap()` from an effect and React's
 * `StrictMode` invokes effects twice in development — which produced exactly this: two
 * `POST /admin/auth/refresh` on every page load, the second `401`, the family revoked,
 * and the console back on the sign-in screen after every reload. The other way is a
 * burst of screens each hitting a `401` at the same moment.
 *
 * It stayed invisible until the API's cookie path was fixed, because before that every
 * refresh failed anyway and there was nothing to race.
 */
let rotating: Promise<AuthSession | null> | null = null;

function rotateOnce(): Promise<AuthSession | null> {
  rotating ??= authRepository
    .refresh()
    .catch(() => null)
    .finally(() => {
      rotating = null;
    });
  return rotating;
}

const anonymous = {
  status: 'anonymous' as AuthStatus,
  user: null,
  grants: {} as CapabilityGrants,
  accessToken: null,
  expiresAt: null,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...anonymous,
  status: 'bootstrapping',

  /**
   * **One round trip, not two.**
   *
   * The rotation answers with the whole session — token, user and grants — because the
   * API re-resolves grants on every refresh. A follow-up `GET /admin/auth/me` would ask
   * for a payload already in hand, and would do it on the critical path of the first
   * paint after every reload.
   */
  bootstrap: async () => {
    const session = await rotateOnce();
    if (session) {
      applySession(set, session);
      return;
    }
    // No refresh cookie, or it has expired. Not an error — it is the normal state of a
    // browser that has never signed in.
    set({ ...anonymous });
  },

  login: async (email, password) => {
    const session = await authRepository.login(email, password);
    applySession(set, session);
    return 'authenticated';
  },

  logout: async () => {
    await authRepository.logout();
    set({ ...anonymous });
  },

  refresh: async () => {
    const session = await rotateOnce();
    if (session) {
      /**
       * The **user and the grants too**, not only the token.
       *
       * The API re-resolves grants on every rotation, so this is the moment a permission
       * change reaches a console that has been open since the morning. Setting the token
       * alone would leave a clerk holding the grant set they signed in with — which is
       * either a lever that 403s or a screen they should have regained.
       */
      applySession(set, session);
      return session.accessToken;
    }

    /**
     * A dropped connection is not a dead session.
     *
     * `rotateOnce` swallows the reason, so the distinction is drawn from what the store
     * still holds: a token that has not expired is worth keeping while the office wifi
     * blinks. Anything else is terminal, and clearing is what routes to sign-in.
     */
    const expiresAt = get().expiresAt;
    if (expiresAt && Date.parse(expiresAt) > Date.now()) return get().accessToken;

    set({ ...anonymous });
    return null;
  },

  clear: () => set({ ...anonymous }),
}));

function applySession(
  set: (partial: Partial<AuthState>) => void,
  session: AuthSession,
): void {
  set({
    status: 'authenticated',
    user: session.user,
    grants: session.grants,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
  });
}

/**
 * Wire the store into the transport.
 *
 * Called once from `main.tsx`. It is a registration rather than an import
 * because the dependency runs the other way: the store imports repositories,
 * which import endpoints, which import the client.
 */
export function connectAuthToTransport(): void {
  setAuthBridge({
    getAccessToken: () => useAuthStore.getState().accessToken,
    refresh: () => useAuthStore.getState().refresh(),
    onSessionLost: () => useAuthStore.getState().clear(),
  });
}

/* ─────────────────────────────── selectors ─────────────────────────────── */

export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useAuthStatus = () => useAuthStore((s) => s.status);

/**
 * May the current session do this?
 *
 * A courtesy, not a control (admin-console.md → Auth and roles): permissions are
 * enforced server-side per endpoint, and this only decides whether to render a
 * lever that would 403 anyway. Hiding it is kinder than offering it.
 */
export function useCan(capability: Capability, level: Exclude<AccessLevel, 'none'> = 'read') {
  return useAuthStore((s) => canDo(s.grants, capability, level));
}
