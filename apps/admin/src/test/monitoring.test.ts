/**
 * Error reporting (`lib/monitoring.ts`): what may leave a clerk's browser, and that nothing
 * does without a DSN.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import type * as EnvModule from '@/config/env';

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  breadcrumbsIntegration: vi.fn(() => ({ name: 'Breadcrumbs' })),
}));
vi.mock('@/lib/sentrySdk', () => sdk);

const config = vi.hoisted(() => ({ dsn: '' }));
vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key) => (key === 'sentryDsn' ? config.dsn : target[key as keyof typeof target]),
    }),
  };
});

const load = async () => {
  vi.resetModules();
  return import('@/lib/monitoring');
};

beforeEach(() => {
  vi.clearAllMocks();
  config.dsn = '';
});

describe('error reporting', () => {
  it('loads nothing and sends nothing without a DSN', async () => {
    const { monitoring } = await load();
    await monitoring.start({ tenant: 'galaboda' });
    monitoring.recordError(new Error('boom'));
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it('starts with the tenant, no user data and errors only', async () => {
    config.dsn = 'https://key@o1.ingest.sentry.io/1';
    const { monitoring } = await load();
    await monitoring.start({ tenant: 'galaboda' });
    const options = sdk.init.mock.calls[0]![0];
    expect(options.dsn).toBe(config.dsn);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false, urlQueryParams: false });
    expect(options.initialScope).toEqual({ tags: { tenant: 'galaboda' } });
  });

  it('keeps what was reported before the SDK loaded, and the user by id only', async () => {
    config.dsn = 'https://key@o1.ingest.sentry.io/1';
    const { monitoring } = await load();
    monitoring.setUser('usr-clerk');
    monitoring.recordError(new Error('early'), 'route');
    await monitoring.start({ tenant: 'galaboda' });
    expect(sdk.setUser).toHaveBeenCalledWith({ id: 'usr-clerk' });
    expect(sdk.captureException).toHaveBeenCalledWith(new Error('early'), { tags: { where: 'route' } });
  });

  it('sends a server failure by code and status, and not a refusal or a dropped connection', async () => {
    config.dsn = 'https://key@o1.ingest.sentry.io/1';
    const { monitoring } = await load();
    // The same module instance `monitoring` was loaded with, so `instanceof` holds.
    const { ApiError } = await import('@/services/api/errors');
    await monitoring.start({ tenant: 'galaboda' });
    monitoring.recordError(new ApiError({ code: 'internal', status: 500, message: 'Sunil 70000137 failed' }));
    monitoring.recordError(new ApiError({ code: 'four-eyes-violation', status: 409, message: 'no' }));
    monitoring.recordError(new ApiError({ code: 'network', message: 'offline' }));

    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    const sent = sdk.captureException.mock.calls[0]![0] as Error;
    expect(sent.message).toBe('ApiError internal 500');
  });
});

describe('what an event and a breadcrumb may carry', () => {
  it('drops the query string, the request details and everything about the user but the id', async () => {
    const { scrubEvent } = await load();
    const event = scrubEvent({
      type: undefined,
      request: { url: 'https://galaboda.admin/suppliers?q=Sunil', headers: { Cookie: 'x' }, query_string: 'q=Sunil' },
      user: { id: 'usr-1', email: 'clerk@galabodatea.lk', ip_address: '1.2.3.4' },
    } as ErrorEvent);
    expect(event.request).toEqual({ url: 'https://galaboda.admin/suppliers' });
    expect(event.user).toEqual({ id: 'usr-1' });
  });

  it('drops clicks and console lines, and strips searches from API calls and navigation', async () => {
    const { scrubBreadcrumb } = await load();
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'tr > td "K.A. Sunil"' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
    expect(
      scrubBreadcrumb({ category: 'fetch', data: { url: 'https://api/v1/admin/suppliers?q=Sunil', method: 'GET' } } as Breadcrumb)
        ?.data,
    ).toEqual({ url: 'https://api/v1/admin/suppliers', method: 'GET' });
    expect(
      scrubBreadcrumb({ category: 'navigation', data: { from: '/suppliers?q=Sunil', to: '/credit?status=pending' } })?.data
        ?.to,
    ).toBe('/credit');
  });
});
