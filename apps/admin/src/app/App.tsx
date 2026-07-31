/**
 * The provider stack.
 *
 * The order is load-bearing, top to bottom:
 *
 *  1. `QueryClientProvider` — everything below fetches.
 *  2. `RuntimeConfigProvider` — resolves the tenant's config. Fetches, so it
 *     needs the client above it; provides flags, so it needs to be above the
 *     brand and the routes.
 *  3. `BrandProvider` — reads that config to apply the theme, title and favicon.
 *  4. `ToastProvider` — needs the brand's tokens to be applied before it paints.
 *  5. `RouterProvider` — the screens, which read all of the above.
 *
 * Auth is deliberately **not** a provider. It is a Zustand store, so the
 * transport's 401 interceptor can reach the session without a React tree — an
 * interceptor cannot call a hook.
 */

import { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createQueryClient } from '@/query/queryClient';
import { RuntimeConfigProvider } from '@/config/RuntimeConfigProvider';
import { BrandProvider } from '@/brand/BrandProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { useAuthStore } from '@/auth/authStore';
import { router } from '@/routes/router';

export function App() {
  // One client for the app's life. Recreating it would drop every cache on any
  // re-render of this component.
  const queryClient = useMemo(() => createQueryClient(), []);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    // There is no access token on a fresh document — it lives in memory only — so
    // the session is recovered from the refresh cookie before anything renders
    // behind `RequireAuth`.
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeConfigProvider>
        <BrandProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </BrandProvider>
      </RuntimeConfigProvider>
    </QueryClientProvider>
  );
}
