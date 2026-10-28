/**
 * Error reporting: what broke in a clerk's browser, sent to Sentry, so the office does not
 * have to describe it over the phone.
 *
 * **Off unless `VITE_SENTRY_DSN` is set**, and then the SDK is loaded on its own chunk, so a
 * console without a DSN carries none of it. Once loaded, Sentry's own handlers catch what
 * nothing else did (an uncaught error, an unhandled rejection); `recordError` adds what
 * the console catches and would otherwise only log: a route that failed to render, an API
 * call the server failed.
 *
 * **What is never sent** (§20.4, BR-504): a supplier's name, phone, NIC or bank account, a
 * server's message (it may quote the request back), a query string (a search for a name),
 * what was clicked or typed, or the console's log. An `ApiError` goes as its `code` and
 * `status`; the user as their internal id; the factory as its tenant id.
 */

import type * as SentrySdk from './sentrySdk';
import type { ErrorEvent, Breadcrumb } from '@sentry/react';
import { env } from '@/config/env';
import { isApiError, isTransportError } from '@/services/api/errors';

type Sentry = typeof SentrySdk;

let sentry: Sentry | null = null;
/** Calls made before the SDK finished loading, replayed once it has (a few at most). */
const waiting: ((sdk: Sentry) => void)[] = [];
const WAITING_LIMIT = 20;

function withSentry(call: (sdk: Sentry) => void): void {
  if (sentry) call(sentry);
  else if (env.sentryDsn && waiting.length < WAITING_LIMIT) waiting.push(call);
}

/** `https://api/x?q=Sunil` → `https://api/x`: a search is somebody's name. */
export function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** The event as it may leave the browser: no request details beyond the bare URL. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = event.request.url ? { url: withoutQuery(event.request.url) } : {};
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  return event;
}

/**
 * Breadcrumbs: navigation and API calls (by path), nothing a clerk clicked or typed. A
 * click breadcrumb names the element, and a row's accessible name is a supplier's name.
 */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category?.startsWith('ui.') || crumb.category === 'console') return null;
  if (crumb.data && typeof crumb.data.url === 'string') {
    crumb.data = { ...crumb.data, url: withoutQuery(crumb.data.url) };
  }
  if (crumb.data && typeof crumb.data.to === 'string') {
    crumb.data = { ...crumb.data, to: withoutQuery(crumb.data.to), from: undefined };
  }
  return crumb;
}

/**
 * An error the report may carry, or `null` for one the console answers itself.
 *
 * A refusal (`403`, `409`, `422`) is the API working, and a dropped connection is the
 * office's network: neither is a fault to fix here. A server failure is, by code and
 * status alone.
 */
export function reportable(error: unknown): Error | null {
  if (isApiError(error)) {
    if (isTransportError(error)) return null;
    if (error.status !== undefined && error.status < 500) return null;
    const safe = new Error(`ApiError ${error.code}${error.status ? ` ${error.status}` : ''}`);
    safe.name = 'ApiError';
    return safe;
  }
  return error instanceof Error ? error : new Error(String(error));
}

export const monitoring = {
  /**
   * Load and start Sentry, if this build has a DSN. Called once from `main.tsx`, before
   * the first render; returns without loading anything when there is no DSN.
   */
  async start(context: { tenant: string }): Promise<void> {
    if (!env.sentryDsn || sentry) return;
    const sdk = await import('./sentrySdk');
    sdk.init({
      dsn: env.sentryDsn,
      environment: env.sentryEnvironment,
      // Nothing about the user, and nothing from a request but its bare URL.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      // Errors only: no performance tracing and no session replay, which would record
      // the screens themselves.
      tracesSampleRate: 0,
      // No click breadcrumbs: they name the element, and a row's name is a supplier's.
      integrations: [sdk.breadcrumbsIntegration({ dom: false })],
      beforeBreadcrumb: scrubBreadcrumb,
      beforeSend: scrubEvent,
      initialScope: { tags: { tenant: context.tenant } },
    });
    sentry = sdk;
    for (const call of waiting.splice(0)) call(sdk);
  },

  /** The signed-in user by internal id only, or `null` on sign-out. */
  setUser(userId: string | null): void {
    withSentry((sdk) => sdk.setUser(userId ? { id: userId } : null));
  },

  /** Something the console caught and can only log. Refusals and network drops are not sent. */
  recordError(error: unknown, where?: string): void {
    const safe = reportable(error);
    if (!safe) return;
    withSentry((sdk) => sdk.captureException(safe, where ? { tags: { where } } : undefined));
  },
};
