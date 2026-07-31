/**
 * Entry point. Four things happen before React mounts, and the order matters.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme, brandForTenant, createTheme } from '@tfd/brand';
import { assertEnvUsable, env } from '@/config/env';
import { tenantId } from '@/config/tenant';
import { connectAuthToTransport } from '@/auth/authStore';
import { App } from '@/app/App';
import '@/i18n';
import '@/styles/theme.css';

/**
 * 1. Refuse to boot a misconfigured production bundle.
 *
 * A console that looks fine, serves fixtures, and reports every failure as a
 * network problem is the worst outcome available. Better to fail loudly here.
 */
assertEnvUsable();

/**
 * 2. Apply the bundled tenant theme **synchronously**.
 *
 * The stylesheet's tokens are `var(--brand-*)` with no fallback values, so a paint
 * before this line would be unstyled. Doing it here rather than in a `useEffect`
 * is what makes the first frame branded — and it is why `theme.css` can avoid
 * duplicating the palette in CSS.
 *
 * `BrandProvider` re-applies once `GET /config` lands, which is how a rebrand from
 * M14 reaches a running console.
 */
applyTheme(document.documentElement, createTheme('light', brandForTenant(tenantId).theme));

/** 3. Let the transport read and refresh the session (see `authStore`). */
connectAuthToTransport();

/**
 * 4. Start the mock, if it is on, and **await it** before rendering.
 *
 * Without the await, the first requests race the service worker's registration
 * and fall through to a domain nobody owns — which looks exactly like the backend
 * being down.
 *
 * The `import.meta.env.DEV` guard is not redundant with `env.useMock`. Vite
 * replaces it with a literal `false` in a normal production build, so the whole
 * branch and the ~300 kB MSW chunk behind it are eliminated rather than shipped
 * as a lazy chunk nobody loads.
 *
 * The demo build (`npm run build:demo`) is the one exception. It is spelled
 * `import.meta.env.MODE === 'demo'` inline rather than `env.demoMode` so it stays
 * a *literal* the bundler can fold: in a normal production build this whole
 * condition collapses to `false` and the MSW chunk disappears as before. Reading
 * the flag off the `env` object instead would leave the branch un-foldable and
 * emit the chunk into every production `dist`.
 */
async function start() {
  if ((import.meta.env.DEV || import.meta.env.MODE === 'demo') && env.useMock) {
    const { startMockWorker } = await import('@/services/mocks/browser');
    await startMockWorker();
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('#root is missing from index.html');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
