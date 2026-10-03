/**
 * Entry point. Four things happen before React mounts, and the order matters.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme, brandForTenant, createTheme } from '@tfd/brand';
import { assertEnvUsable } from '@/config/env';
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
 * 4. Render.
 *
 * **Nothing is intercepted any more.** Every request on this page reaches the API at
 * `VITE_API_BASE_URL`; there is no in-browser mock, no demo build and no `VITE_USE_MOCK`.
 * The fixtures survive in `services/mocks/handlers.ts` for Vitest alone, where answering
 * from a fixture is the point — but a running console that served them would be
 * indistinguishable from a working one, which is the worst outcome available to an office
 * that trusts what it sees.
 */
const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
