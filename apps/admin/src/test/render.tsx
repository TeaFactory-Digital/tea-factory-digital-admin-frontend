/**
 * Test render helper: the real provider stack, minus the router's browser history.
 *
 * It signs in through the real endpoint rather than injecting a fake session,
 * because the session shape and the grants are part of what is under test — a
 * hand-built session object would let an RBAC regression pass.
 */

import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PropsWithChildren, ReactElement } from 'react';
import { RuntimeConfigProvider } from '@/config/RuntimeConfigProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { connectAuthToTransport, useAuthStore } from '@/auth/authStore';
import { MOCK_MFA_CODE, MOCK_PASSWORD } from '@/services/mocks/seed';

connectAuthToTransport();

/** No retries and no caching between tests — a retry turns a failure into a hang. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient = createTestQueryClient(), ...options }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <RuntimeConfigProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </ToastProvider>
        </RuntimeConfigProvider>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Sign in for real, so grants and the access token come from the mock API. */
export async function signInAs(email: string): Promise<void> {
  await useAuthStore.getState().login(email, MOCK_PASSWORD);
}

/**
 * Sign in an account that has MFA enrolled — manager and above.
 *
 * Two steps, because one is not a session: a password that was correct leaves the
 * store in `mfaRequired` with no access token, which is the behaviour worth
 * relying on rather than working around.
 */
export async function signInWithMfaAs(email: string): Promise<void> {
  const status = await useAuthStore.getState().login(email, MOCK_PASSWORD);
  if (status !== 'mfaRequired') {
    throw new Error(`${email} does not require MFA — use signInAs instead.`);
  }
  await useAuthStore.getState().verifyMfa(MOCK_MFA_CODE);
}

export function signOut(): void {
  useAuthStore.getState().clear();
}
