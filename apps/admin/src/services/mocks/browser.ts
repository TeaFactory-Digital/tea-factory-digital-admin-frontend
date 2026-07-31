/**
 * The in-browser mock, started before React mounts when `VITE_USE_MOCK` is on.
 *
 * A service worker rather than a stubbed axios adapter, deliberately: the console
 * exercises its real transport — interceptors, refresh-on-401, idempotency
 * headers, the error envelope — so swapping to the live API changes what answers,
 * not how the console asks.
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export async function startMockWorker(): Promise<void> {
  await worker.start({
    // Anything unhandled is a request the contract does not cover yet. Warn
    // loudly — a silent passthrough to a domain nobody owns looks like a network
    // fault and wastes an afternoon.
    onUnhandledRequest: 'warn',
    quiet: false,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}
