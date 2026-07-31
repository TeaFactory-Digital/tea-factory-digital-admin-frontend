import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * The smoke suite against the **built demo bundle**, served as static files.
 *
 * `playwright.config.ts` runs against the dev server, which proves the code. This
 * runs against `dist/` behind `vite preview` — a static host with SPA fallback,
 * which is what Vercel is. It is the only check that can catch the failures unique
 * to the deployed artefact:
 *
 *  - `assertEnvUsable()` throwing on boot, because `--mode demo` is a *production*
 *    build and the placeholder-origin guard applies to those (see config/env.ts).
 *  - MSW tree-shaken out, leaving a console that renders and then answers nothing.
 *  - The tenant resolving to a deployment name instead of a factory, which is what
 *    `PLATFORM_DOMAINS` in `@tfd/brand` exists to prevent.
 *
 * Usage: `npm run build:demo && npm run e2e:demo` from the workspace root.
 */
export default defineConfig({
  ...base,
  // The dev-server webServer from the base config would serve the source, not the
  // bundle, and silently make this identical to `npm run e2e`.
  webServer: {
    command: 'npx vite preview --port 4188 --strictPort',
    url: 'http://localhost:4188/sign-in',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: { ...base.use, baseURL: 'http://localhost:4188' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
