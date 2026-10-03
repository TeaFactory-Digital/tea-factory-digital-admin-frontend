import '@testing-library/jest-dom/vitest';
// Real translations, so a test asserts on the copy a clerk sees rather than on a
// raw key. Without this, `t('changeRequests.fourEyes.title')` renders as its own
// key and every text assertion silently matches the wrong thing.
import '@/i18n';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/services/mocks/server';
import { resetMockState } from '@/services/mocks/handlers';

/**
 * The same MSW handlers the browser uses, in Node.
 *
 * Deliberate: a test that passes against different fixtures from the ones a
 * developer clicks through proves nothing about the console. `onUnhandledRequest:
 * 'error'` is stricter here than in the browser — an unmocked call in a test is a
 * gap in the contract, not a warning to scroll past.
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

/**
 * jsdom has no `ResizeObserver`, which Radix uses to place a tooltip or popup. Every
 * browser the console supports has one; without this stand-in, any screen with an "i"
 * tooltip fails to render in a test.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// The same for pointer capture and scrolling, which a Radix Select calls when it opens.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

afterEach(() => {
  server.resetHandlers();
  // Module-scope state survives between test files; a decided change request
  // leaking into the next case would make failures order-dependent.
  resetMockState();
});

afterAll(() => server.close());
