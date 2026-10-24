import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end, in a real browser.
 *
 * Narrow on purpose. The Vitest + MSW suite already covers the console's logic in
 * jsdom, and duplicating it here would buy slow tests rather than confidence. What
 * only a browser can prove is the part jsdom fakes: that the **service worker
 * starts**, that the **CSS-variable brand bridge actually paints**, and that the
 * sign-in → dashboard path works against the built app.
 *
 * **The API is answered by the tests** (`e2e/fixtures.ts`), from the same MSW handlers as
 * Vitest: the console itself has no in-browser mock. Its own dev server runs on 5274 with
 * `VITE_API_BASE_URL` pointed at `/v1` on that same origin, so every call is intercepted
 * and none can reach a real backend. Sign in with the fixture's accounts
 * (`clerk@galabodatea.lk`, `demo1234`).
 *
 * Needs `npx playwright install chromium` once: the browsers are not installed by
 * `npm install`, so `npm run e2e` will tell you to do that rather than mysteriously
 * failing.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5274',
    trace: 'on-first-retry',
    // The office runs 1366×768 laptops; testing at 1920 hides every layout
    // problem that actually gets reported.
    viewport: { width: 1366, height: 768 },
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // Its own port, never a developer's `npm run dev` (5273, pointed at a real API).
    command: 'npx vite --port 5274 --strictPort',
    url: 'http://localhost:5274',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_API_BASE_URL: 'http://localhost:5274/v1', VITE_DEFAULT_TENANT: 'galaboda' },
  },
});
