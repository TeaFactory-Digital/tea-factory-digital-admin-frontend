/**
 * Whether this computer has a connection (26 November 2026), from the browser's own
 * `online` / `offline` events.
 *
 * The browser's answer is "has a network", not "reaches the API": a router with no line out
 * still says online. So this only ever adds a warning; a request that fails still says why
 * on its own (`ErrorState`), and TanStack Query already refetches when the connection returns.
 */

import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

const read = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}
