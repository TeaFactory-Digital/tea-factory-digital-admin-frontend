/**
 * M11's promo banners against the mock API — **the editor v1 did not have**.
 *
 * `enablePromoBanner` shipped in the flag set, `PromoBanner` shipped in the domain
 * package, `banners.md` specified the whole feature, and there was no way to author one.
 * A factory could turn the switch on and get nothing.
 *
 * The cases here are the two rules that separate a banner from an article, and both exist
 * because of the same property: **the app fails silently on a banner.**
 *
 *  - An unresolvable action renders artwork with *no button* and reports nothing, so a
 *    banner saved with one looks published from every screen in this console and is inert
 *    on every phone. It is therefore refused at authoring, at patch and at publish — with
 *    the app's own resolver, not a second implementation of the allowlist.
 *  - A backwards window makes `isBannerLive` return false for ever, which looks exactly
 *    like a working banner nobody has scrolled to.
 *
 * The AC-08 machinery is asserted too, and deliberately against `isBannerWritten` rather
 * than `isWritten`: a headline-only banner is a normal banner, and a banner with no button
 * label is not.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  EDITORIAL_FALLBACK_LANGUAGE,
  bannerActionProblem,
  bannerTarget,
  bannerWindowState,
  isBannerWritten,
} from '@tfd/domain';
import { bannerRepository } from '@/services/repositories/bannerRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signOut } from './render';

const EDITOR = 'editor@galabodatea.lk';
const FACTORY_ADMIN = 'factoryadmin@galabodatea.lk';

const FUTURE = '2030-01-01T00:00:00.000Z';
const LATER = '2030-02-01T00:00:00.000Z';

function draft(overrides: Partial<Parameters<typeof bannerRepository.create>[0]> = {}) {
  return {
    translations: [
      {
        lang: EDITORIAL_FALLBACK_LANGUAGE,
        title: 'Fertilizer issue',
        buttonLabel: 'Request manure',
      },
    ],
    action: { type: 'screen' as const, path: 'manure' },
    startsAt: FUTURE,
    endsAt: LATER,
    ...overrides,
  };
}

describe('M11 promo banners', () => {
  beforeEach(() => {
    signOut();
  });

  it('reports where each banner is in its window, from the server’s clock', async () => {
    await signInAs(EDITOR);
    const page = await bannerRepository.list({ pageSize: 50 });

    // The fixture holds one of each on purpose: live, expired and scheduled are three
    // different answers to "is a supplier seeing this", and only the first is yes.
    const windows = new Set(
      page.items.filter((one) => one.status === 'published').map((one) => one.window),
    );
    expect(windows).toEqual(new Set(['live', 'expired', 'scheduled']));
  });

  it('filters to what is live, and a draft is never “scheduled”', async () => {
    await signInAs(EDITOR);
    const live = await bannerRepository.list({ window: 'live', pageSize: 50 });
    expect(live.items.length).toBeGreaterThan(0);
    expect(live.items.every((one) => one.status === 'published')).toBe(true);

    /**
     * A draft is unfinished work, not something waiting to appear. Letting it match
     * `scheduled` would put rows in the office's "coming up" list that nobody has agreed
     * to send.
     */
    const scheduled = await bannerRepository.list({ window: 'scheduled', pageSize: 50 });
    expect(scheduled.items.every((one) => one.status === 'published')).toBe(true);
  });

  it('refuses an action the app would drop, by name', async () => {
    await signInAs(EDITOR);

    // The mistake an editor makes on purpose: the app's own scheme looks like the way to
    // reach an app screen, and the app refuses it precisely so a path gets route-checked.
    const smuggled = await bannerRepository
      .create(draft({ action: { type: 'url', url: 'teafactory://manure' } }))
      .catch((cause: unknown) => cause);
    expect(isApiError(smuggled) && smuggled.code).toBe('banner-action-refused');
    expect(bannerActionProblem({ type: 'url', url: 'teafactory://manure' })).toBe(
      'banners.action.appSchemeRefused',
    );

    const badScheme = await bannerRepository
      .create(draft({ action: { type: 'url', url: 'ftp://example.lk/notice' } }))
      .catch((cause: unknown) => cause);
    expect(isApiError(badScheme) && badScheme.code).toBe('banner-action-refused');

    // A path carrying a query string is a path the linking config cannot match.
    const badPath = await bannerRepository
      .create(draft({ action: { type: 'screen', path: 'news?id=1' } }))
      .catch((cause: unknown) => cause);
    expect(isApiError(badPath) && badPath.code).toBe('banner-action-refused');
  });

  it('refuses a window that ends before it starts', async () => {
    await signInAs(EDITOR);
    const backwards = await bannerRepository
      .create(draft({ startsAt: LATER, endsAt: FUTURE }))
      .catch((cause: unknown) => cause);

    // Silent otherwise: `isBannerLive` returns false for ever and the office sees a
    // published row while suppliers see nothing.
    expect(isApiError(backwards) && backwards.code).toBe('banner-window-invalid');
  });

  it('refuses a banner with no fallback copy, and one with no button label', async () => {
    await signInAs(EDITOR);

    const noCopy = await bannerRepository
      .create(draft({ translations: [] }))
      .catch((cause: unknown) => cause);
    expect(isApiError(noCopy) && noCopy.code).toBe('fallback-translation-missing');

    /**
     * A headline with no button label is the case `isWritten` would have got wrong: the
     * article rule asks for a title and a **body**, so it would have accepted this and
     * reported the language as written — and a supplier would get artwork with no way out
     * of it.
     */
    const noButton = await bannerRepository
      .create(
        draft({
          translations: [{ lang: EDITORIAL_FALLBACK_LANGUAGE, title: 'Notice', buttonLabel: '  ' }],
        }),
      )
      .catch((cause: unknown) => cause);
    expect(isApiError(noButton)).toBe(true);
  });

  it('creates a draft, never a published banner (§12.1)', async () => {
    await signInAs(EDITOR);
    const created = await bannerRepository.create(draft());

    // The editor writes; the factory administrator publishes. The same boundary M11's
    // articles draw between writing a circular and putting it in front of everybody.
    expect(created.status).toBe('draft');

    const refused = await bannerRepository.publish(created.id).catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  });

  it('publishes with a translation gap and refuses one with a broken button', async () => {
    await signInAs(EDITOR);
    const created = await bannerRepository.create(draft());

    signOut();
    await signInAs(FACTORY_ADMIN);

    /**
     * **Publishing with a gap is allowed and loud** — the AC-08 policy, not a compromise.
     * The English copy exists, so a Sinhala supplier reads the English and the console
     * names the languages in the confirmation.
     */
    const published = await bannerRepository.publish(created.id);
    expect(published.status).toBe('published');
    expect(published.missingLanguages).toContain('si');

    // But an action has nothing to fall back **to**, so it blocks. Patched to something
    // broken, the publish must refuse rather than warn.
    const second = await bannerRepository.create(draft());
    const patched = await bannerRepository
      .patch(second.id, { action: { type: 'url', url: 'not a url' } })
      .catch((cause: unknown) => cause);
    expect(isApiError(patched) && patched.code).toBe('banner-action-refused');
  });

  it('takes a banner down immediately, whatever the window says', async () => {
    await signInAs(FACTORY_ADMIN);
    const page = await bannerRepository.list({ window: 'live', pageSize: 50 });
    const live = page.items[0]!;

    // The window is a schedule; this is an intervention. A banner announcing a wrong
    // price has to stop showing this afternoon, not when `endsAt` comes round.
    const down = await bannerRepository.unpublish(live.id);
    expect(down.status).toBe('draft');
  });

  it('refuses the module for a tenant that does not buy it (AC-07)', async () => {
    await signInAs(EDITOR);
    const token = useAuthStore.getState().accessToken;

    // `highland` has `enablePromoBanner: false`.
    const response = await fetch('http://localhost/admin/banners', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'highland' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'feature-disabled' });
  });
});

describe('the banner action allowlist (shared with the app)', () => {
  it('resolves exactly what the phone resolves', () => {
    // Ported verbatim from the app's `src/services/banners`. Two implementations would
    // agree until the first one gained a scheme.
    expect(bannerTarget({ type: 'screen', path: 'bill/2026-07' })).toEqual({
      kind: 'path',
      path: 'bill/2026-07',
    });
    // A leading slash is tolerated and stripped; a dot never is, so `..` cannot appear.
    expect(bannerTarget({ type: 'screen', path: '/manure' })).toEqual({
      kind: 'path',
      path: 'manure',
    });
    expect(bannerTarget({ type: 'screen', path: '../admin' })).toBeNull();

    expect(bannerTarget({ type: 'url', url: 'https://example.lk' })?.kind).toBe('url');
    expect(bannerTarget({ type: 'url', url: 'tel:+94812234567' })?.kind).toBe('url');
    expect(bannerTarget({ type: 'url', url: 'mailto:office@example.lk' })?.kind).toBe('url');
    expect(bannerTarget({ type: 'url', url: 'javascript:alert(1)' })).toBeNull();
  });

  it('reads a window the way the app does', () => {
    const now = '2026-08-08T00:00:00.000Z';
    expect(bannerWindowState({ startsAt: '2026-09-01T00:00:00.000Z', endsAt: null }, now)).toBe(
      'scheduled',
    );
    expect(bannerWindowState({ startsAt: '2026-08-01T00:00:00.000Z', endsAt: null }, now)).toBe(
      'live',
    );
    expect(
      bannerWindowState(
        { startsAt: '2026-07-01T00:00:00.000Z', endsAt: '2026-07-30T00:00:00.000Z' },
        now,
      ),
    ).toBe('expired');
  });

  it('counts a headline-and-button banner as written, and a label-less one as not', () => {
    const base = { lang: 'en' as const, updatedAt: FUTURE, updatedByName: 'Editor' };

    // A supporting line is optional — plenty of banners are a headline and a button.
    expect(isBannerWritten({ ...base, title: 'Notice', body: '', buttonLabel: 'Open' })).toBe(true);
    expect(isBannerWritten({ ...base, title: 'Notice', body: 'More', buttonLabel: '' })).toBe(false);
    expect(isBannerWritten({ ...base, title: '  ', body: 'More', buttonLabel: 'Open' })).toBe(false);
    expect(isBannerWritten(undefined)).toBe(false);
  });
});
