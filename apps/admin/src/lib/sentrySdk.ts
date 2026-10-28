/**
 * The four parts of the Sentry SDK the console uses, and nothing else.
 *
 * `lib/monitoring.ts` loads this file, not `@sentry/react`, so the bundler keeps only what
 * is named here: importing the whole package would bring session replay and the feedback
 * widget into the chunk, several times the size, for features the console turns off.
 */
export { breadcrumbsIntegration, captureException, init, setUser } from '@sentry/react';
