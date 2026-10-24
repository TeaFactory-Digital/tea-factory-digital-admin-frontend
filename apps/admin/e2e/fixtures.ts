import { test as base, expect } from '@playwright/test';
import { getResponse } from 'msw';
import { handlers, resetMockState } from '../src/services/mocks/handlers';

/**
 * The API, answered by the test itself.
 *
 * The console has no in-browser mock any more (`main.tsx`): a running console that served
 * fixtures would look exactly like a working one. So the browser here runs the **real**
 * app, and its API calls (`VITE_API_BASE_URL`, pointed at `/v1` on the e2e server by
 * `playwright.config.ts`) are answered in this Node process by the same MSW handlers the
 * Vitest suite uses. Nothing mock-related is served to the page or bundled into a build.
 *
 * Every test starts from a fresh fixture state, so tests stay independent.
 */
export const test = base.extend<{ mockApi: void }>({
  mockApi: [
    async ({ page }, use) => {
      resetMockState();
      await page.route('**/v1/**', async (route) => {
        const sent = route.request();
        const method = sent.method();
        const body = method === 'GET' || method === 'HEAD' ? undefined : (sent.postDataBuffer() ? new Uint8Array(sent.postDataBuffer()!) : undefined);
        const request = new Request(sent.url(), { method, headers: sent.headers(), body });
        const answer = await getResponse(handlers, request);
        if (!answer) {
          await route.fulfill({ status: 404, json: { code: 'not-found', message: `No mock for ${method} ${sent.url()}` } });
          return;
        }
        await route.fulfill({
          status: answer.status,
          headers: Object.fromEntries(answer.headers.entries()),
          body: Buffer.from(await answer.arrayBuffer()),
        });
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
