/**
 * Animations and interface sounds (26 November 2026): two switches on the profile.
 *
 * What these guard is the defaults and the reach of each switch, the parts that get
 * "tidied" later: sounds start **off** (a shared office, nobody asked for them), animations
 * start **on** (the console as it has always been), and turning animations off has to stop
 * scripted motion as well as CSS, which is why both read one attribute.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceProvider } from '@/brand/AppearanceProvider';
import { AppearanceControls } from '@/brand/AppearanceControls';
import { BrandProvider } from '@/brand/BrandProvider';
import { DEFAULT_APPEARANCE, readAppearance } from '@/brand/appearance';
import { ProfileScreen } from '@/modules/profile/ProfileScreen';
import { motionAllowed } from '@/lib/motion';
import { getUiSound, playSound, setUiSound } from '@/lib/sound/uiSound';
import { sounds } from '@/lib/sound/engine';
import { Sidebar } from '@/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { installLocalStorage } from './localStorage';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => {
  installLocalStorage();
  setUiSound(false);
});

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the animations switch', () => {
  it('starts on, and an older saved preference without it reads as on', () => {
    expect(DEFAULT_APPEARANCE.motion).toBe(true);
    window.localStorage.setItem('tfd.admin.appearance', JSON.stringify({ scheme: 'dark' }));
    expect(readAppearance().motion).toBe(true);
  });

  it('stops scripted motion and CSS together, through one attribute', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppearanceProvider>
        <BrandProvider>
          <AppearanceControls />
        </BrandProvider>
      </AppearanceProvider>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Animations' });
    expect(within(group).getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
    expect(motionAllowed()).toBe(true);

    await user.click(within(group).getByRole('radio', { name: 'Off' }));
    expect(document.documentElement.dataset.motion).toBe('off');
    expect(motionAllowed()).toBe(false);
    expect(readAppearance().motion).toBe(false);

    await user.click(within(group).getByRole('radio', { name: 'On' }));
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(motionAllowed()).toBe(true);
  });

  it('still says no when the system asks for reduced motion, whatever the switch says', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    expect(motionAllowed()).toBe(false);
  });
});

describe('interface sounds', () => {
  /** Counts the audio contexts made, which is the only way a sound starts. */
  function stubAudio() {
    const made = vi.fn();
    class FakeContext {
      currentTime = 0;
      state = 'running';
      destination = {};
      constructor() {
        made();
      }
      createGain() {
        return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (to: unknown) => to };
      }
      createOscillator() {
        return { type: 'sine', frequency: { setValueAtTime() {} }, connect: (to: unknown) => to, start() {}, stop() {} };
      }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    return made;
  }

  it('starts off, so nothing plays until somebody switches them on', () => {
    expect(getUiSound()).toBe(false);
    const made = stubAudio();
    playSound('tick');
    expect(made).not.toHaveBeenCalled();
  });

  it('plays once switched on, and remembers the choice in this browser', () => {
    const made = stubAudio();
    setUiSound(true);
    expect(window.localStorage.getItem('tfd.admin.uiSound')).toBe('on');
    playSound('tick');
    expect(made).toHaveBeenCalledTimes(1);
  });

  it('is drafted on the profile and lands with "Save preferences"', async () => {
    const user = userEvent.setup();
    signOut();
    await signInAs('clerk@galabodatea.lk');
    const { container } = renderWithProviders(
      <AppearanceProvider>
        <ProfileScreen />
      </AppearanceProvider>,
      { route: '/profile' },
    );
    const view = within(container);

    const group = await view.findByRole('radiogroup', { name: 'Interface sounds' });
    expect(within(group).getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(group).getByRole('radio', { name: 'On' }));
    // A draft: nothing is on until it is saved.
    expect(getUiSound()).toBe(false);

    await user.click(view.getByRole('button', { name: /save preferences/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /save preferences/i }));
    await waitFor(() => expect(getUiSound()).toBe(true));
  });
});

describe('the sidebar', () => {
  const renderSidebar = async (route: string) => {
    signOut();
    await signInAs('manager@galabodatea.lk');
    return renderWithProviders(
      <AppearanceProvider>
        <Sidebar />
      </AppearanceProvider>,
      { route },
    );
  };

  it('draws one tile behind the open row, and none on a screen with no row of its own', async () => {
    const { container, unmount } = await renderSidebar('/suppliers');
    expect(container.querySelectorAll('[data-nav-tile]')).toHaveLength(1);
    unmount();

    const profile = await renderSidebar('/profile');
    expect(profile.container.querySelector('[data-nav-tile]')).toBeNull();
  });

  it('ticks on a click to another screen, and not on the row already open', async () => {
    const user = userEvent.setup();
    const tick = vi.spyOn(sounds, 'tick').mockImplementation(() => {});
    setUiSound(true);
    await renderSidebar('/');
    const nav = screen.getByRole('navigation');

    await user.click(within(nav).getByRole('link', { name: /^suppliers/i }));
    expect(tick).toHaveBeenCalledTimes(1);

    await user.click(within(nav).getByRole('link', { name: /^suppliers/i }));
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('stays silent while sounds are off, the default', async () => {
    const user = userEvent.setup();
    const tick = vi.spyOn(sounds, 'tick').mockImplementation(() => {});
    await renderSidebar('/');

    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: /^suppliers/i }));
    expect(tick).not.toHaveBeenCalled();
  });
});

describe('a button press', () => {
  it('gives a little when enabled, and never when disabled', () => {
    renderWithProviders(
      <>
        <Button>Go</Button>
        <Button disabled>Stop</Button>
      </>,
    );
    // `enabled:` keeps the press off a disabled button even where a browser matches :active.
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('enabled:active:scale-97');
  });
});
