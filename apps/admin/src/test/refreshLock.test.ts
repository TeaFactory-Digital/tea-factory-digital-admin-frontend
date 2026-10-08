import { afterEach, describe, expect, it, vi } from 'vitest';
import { authRepository } from '@/services/repositories/authRepository';
import { useAuthStore } from '@/auth/authStore';

/**
 * Two tabs share one refresh cookie, and the API ends the session when the same refresh
 * token arrives twice at once. So a rotation runs under a Web Lock that every tab queues on.
 */
describe('refresh across tabs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rotates inside the shared refresh lock', async () => {
    const names: string[] = [];
    vi.stubGlobal('navigator', {
      ...navigator,
      locks: {
        request: (name: string, run: () => Promise<unknown>) => {
          names.push(name);
          return run();
        },
      },
    });
    const refresh = vi.spyOn(authRepository, 'refresh').mockResolvedValue(null as never);

    await Promise.all([useAuthStore.getState().refresh(), useAuthStore.getState().refresh()]);

    expect(names).toEqual(['tfd-admin-refresh']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
