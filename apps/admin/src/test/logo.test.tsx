/**
 * The mark and the boot splash.
 *
 * Four things worth a test, because all four are invisible until they are wrong
 * in front of an office:
 *
 *  - a tenant's own logo losing to the bundled default (a rebrand that "did not
 *    apply")
 *  - a logo URL that 404s leaving a broken-image glyph in the sidebar
 *  - the splash outliving the boot and holding the console behind a logo
 *  - the splash *gating* the app rather than covering it, which would delay every
 *    screen's lazy chunk until it cleared
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeConfig } from '@tfd/domain';
import { bundledConfig } from '@/config/defaults';
import { BUNDLED_LOGO_URL } from '@/brand/assets';
import { useAuthStore } from '@/auth/authStore';

/**
 * The runtime config is mocked rather than fetched: what is under test is how the
 * mark reacts to a config, and driving it through MSW would mean editing a seed
 * to assert on a fallback.
 */
const mocks = vi.hoisted(() => ({ config: null as unknown as RuntimeConfig, loading: false }));

vi.mock('@/config/RuntimeConfigProvider', () => ({
  useRuntimeConfig: () => ({ config: mocks.config, loading: mocks.loading, degraded: false }),
  useFactory: () => mocks.config.factory,
}));

const { Logo } = await import('@/brand/Logo');
const { BootSplash, SplashScreen } = await import('@/brand/SplashScreen');

const SPLASH_SUBTITLE = 'Preparing the office console…';

beforeEach(() => {
  mocks.config = {
    ...bundledConfig,
    factory: { ...bundledConfig.factory, name: 'Galaboda Tea Factory' },
  };
  mocks.loading = false;
  useAuthStore.setState({ status: 'anonymous' });
});

afterEach(() => {
  vi.useRealTimers();
});

const markOf = (container: HTMLElement) => container.querySelector('img');

describe('Logo', () => {
  it('draws the bundled mark for a factory that has not uploaded artwork', () => {
    const { container } = render(<Logo />);

    expect(markOf(container)).toHaveAttribute('src', BUNDLED_LOGO_URL);
    expect(screen.getByText('Galaboda Tea Factory')).toBeInTheDocument();
  });

  it('prefers the tenant’s own logo over the bundled one', () => {
    mocks.config.branding = { logoUrl: 'https://cdn.example.lk/galaboda.png' };

    const { container } = render(<Logo />);

    expect(markOf(container)).toHaveAttribute('src', 'https://cdn.example.lk/galaboda.png');
  });

  it('falls back to the bundled mark, then to the initials, as sources fail', () => {
    mocks.config.branding = { logoUrl: 'https://cdn.example.lk/gone.png' };

    const { container } = render(<Logo />);

    // An expired CDN link must not leave a broken-image glyph in the sidebar.
    fireEvent.error(markOf(container)!);
    expect(markOf(container)).toHaveAttribute('src', BUNDLED_LOGO_URL);

    // And if even the bundled file cannot be served, the wordmark still names the
    // factory — the promise white-label.md makes about going live without artwork.
    fireEvent.error(markOf(container)!);
    expect(markOf(container)).toBeNull();
    expect(screen.getByText('GT')).toBeInTheDocument();
  });
});

describe('SplashScreen', () => {
  it('names the factory it is opening', () => {
    render(<SplashScreen />);

    expect(screen.getByText('Galaboda Tea Factory')).toBeInTheDocument();
    expect(screen.getByText(SPLASH_SUBTITLE)).toBeInTheDocument();
  });

  it('covers the app rather than gating it, and clears once the boot settles', () => {
    vi.useFakeTimers();
    // The static splash `index.html` paints before the bundle arrives.
    document.body.insertAdjacentHTML('beforeend', '<div id="boot-splash"></div>');

    render(
      <BootSplash>
        <p>dashboard</p>
      </BootSplash>,
    );

    // Mounted behind the splash from the first frame: a gate here would hold back
    // every screen's lazy chunk until the splash cleared.
    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(screen.getByText(SPLASH_SUBTITLE)).toBeInTheDocument();
    expect(document.getElementById('boot-splash')).toBeNull();

    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.queryByText(SPLASH_SUBTITLE)).not.toBeInTheDocument();
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('gives up on a boot that never settles', () => {
    vi.useFakeTimers();
    // A `/config` that hangs and a session still recovering from the refresh
    // cookie — the console must not be stuck behind a logo. The sign-in form
    // works without either answer.
    mocks.loading = true;
    useAuthStore.setState({ status: 'bootstrapping' });

    render(
      <BootSplash>
        <p>sign in</p>
      </BootSplash>,
    );

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText(SPLASH_SUBTITLE)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.queryByText(SPLASH_SUBTITLE)).not.toBeInTheDocument();
  });
});
