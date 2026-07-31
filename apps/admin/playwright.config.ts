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
 * Needs `npx playwright install chromium` once — the browsers are not installed by
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
    baseURL: 'http://localhost:5273',
    trace: 'on-first-retry',
    // The office runs 1366×768 laptops; testing at 1920 hides every layout
    // problem that actually gets reported.
    viewport: { width: 1366, height: 768 },
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5273',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
