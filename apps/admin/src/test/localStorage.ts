/**
 * A working `localStorage` for tests that need one.
 *
 * This environment's `window.localStorage` is an **empty object** — no `getItem`, no
 * `setItem` — while `sessionStorage` is a real `Storage`. Production code guards every
 * access, which is correct (Safari in private mode throws here rather than returning
 * `null`) but means the guards swallow the absence and persistence cannot be observed.
 *
 * It lived inside `languageSwitcher.test.tsx` under a note that "nothing else in the
 * console touches `localStorage` by design, so giving the whole suite one would be
 * changing shared infrastructure for a single feature's benefit". That stopped being true
 * when the appearance preference arrived — the second thing that is the *reader's* rather
 * than the factory's, for the same §12.1 reason.
 *
 * Still installed per test rather than in `test/setup.ts`, because the guards are worth
 * exercising: a suite that always had storage would never run the path a private window
 * takes.
 */
export function installLocalStorage(): void {
  const entries = new Map<string, string>();
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}
