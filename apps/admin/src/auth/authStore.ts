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
import type { AuthSession, CapabilityGrants, ConsoleUser, MfaChallenge } from '@tfd/domain';
import { can as canDo, type AccessLevel, type Capability } from '@tfd/domain';
import { authRepository } from '@/services/repositories/authRepository';
import { setAuthBridge } from '@/services/api/client';
import { isApiError } from '@/services/api/errors';

export type AuthStatus = 'bootstrapping' | 'anonymous' | 'mfaRequired' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: ConsoleUser | null;
  grants: CapabilityGrants;
  accessToken: string | null;
  expiresAt: string | null;
  challenge: MfaChallenge | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthStatus>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Used by the transport's 401 handler. Returns a fresh token, or null. */
  refresh: () => Promise<string | null>;
  clear: () => void;
}

const anonymous = {
  status: 'anonymous' as AuthStatus,
  user: null,
  grants: {} as CapabilityGrants,
  accessToken: null,
  expiresAt: null,
  challenge: null,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...anonymous,
  status: 'bootstrapping',

  bootstrap: async () => {
    try {
      const { accessToken, expiresAt } = await authRepository.refresh();
      set({ accessToken, expiresAt });
      const { user, grants } = await authRepository.me();
      set({ status: 'authenticated', user, grants, challenge: null });
    } catch {
      // No refresh cookie, or it has expired. Not an error — it is the normal
      // state of a browser that has never signed in.
      set({ ...anonymous });
    }
  },

  login: async (email, password) => {
    const result = await authRepository.login(email, password);

    if (result.status === 'mfaRequired') {
      set({ status: 'mfaRequired', challenge: result.challenge });
      return 'mfaRequired';
    }

    applySession(set, result.session);
    return 'authenticated';
  },

  verifyMfa: async (code) => {
    const challenge = get().challenge;
    if (!challenge) {
      throw new Error('No MFA challenge in progress.');
    }
    const session = await authRepository.verifyMfa(challenge.challengeToken, code);
    applySession(set, session);
  },

  logout: async () => {
    await authRepository.logout();
    set({ ...anonymous });
  },

  refresh: async () => {
    try {
      const { accessToken, expiresAt } = await authRepository.refresh();
      set({ accessToken, expiresAt });
      return accessToken;
    } catch (error) {
      // A refresh that fails for any reason other than transport is terminal:
      // retrying it on a dropped connection would sign a clerk out because the
      // office wifi blinked.
      if (isApiError(error) && error.code === 'network') return get().accessToken;
      set({ ...anonymous });
      return null;
    }
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
    challenge: null,
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
