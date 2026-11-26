/**
 * The look-and-feel round of 23 November 2026: Auto theme, density, high contrast, the icon
 * rail, the shortcuts sheet, counting figures, the publish celebration and new-request
 * alerts. Each is the reader's own choice or pure decoration, so what these guard is that the
 * choice is kept, applied, and never in the way.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import type { ActivityFeed, ActivityItem } from '@tfd/domain';
import { DEFAULT_APPEARANCE, drawnScheme, persistAppearance, readAppearance } from '@/brand/appearance';
import { AppearanceProvider } from '@/brand/AppearanceProvider';
import { AppearanceControls } from '@/brand/AppearanceControls';
import { BrandProvider } from '@/brand/BrandProvider';
import { useAppearance } from '@/brand/useAppearance';
import { CountUp } from '@/components/charts/CountUp';
import { Celebration } from '@/components/Celebration';
import { Sidebar } from '@/layout/Sidebar';
import { ShortcutsDialog } from '@/layout/ShortcutsDialog';
import { useRequestAlerts } from '@/layout/useRequestAlerts';
import { DEFAULT_ALERTS, setAlerts } from '@/lib/requestAlerts';
import { activityRepository } from '@/services/repositories/activityRepository';
import { ProfileScreen } from '@/modules/profile/ProfileScreen';
import { qk } from '@/query/queryKeys';
import { installLocalStorage } from './localStorage';
import { useAuthStore } from '@/auth/authStore';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => {
  installLocalStorage();
  signOut();
});

afterEach(() => {
  const root = document.documentElement;
  delete root.dataset.density;
  delete root.dataset.contrast;
  vi.restoreAllMocks();
});

describe('Auto theme', () => {
  it('is light by day and dark from six in the evening to six in the morning', () => {
    const at = (hour: number) => new Date(2026, 10, 23, hour, 30);
    expect(drawnScheme('auto', at(10))).toBe('light');
    expect(drawnScheme('auto', at(17))).toBe('light');
    expect(drawnScheme('auto', at(18))).toBe('dark');
    expect(drawnScheme('auto', at(23))).toBe('dark');
    expect(drawnScheme('auto', at(5))).toBe('dark');
    expect(drawnScheme('auto', at(6))).toBe('light');
    // A fixed choice ignores the clock.
    expect(drawnScheme('dark', at(10))).toBe('dark');
  });
});

describe('density, contrast and the sidebar mode', () => {
  it('are kept, and a value from a newer build falls back on its own', () => {
    persistAppearance({ ...DEFAULT_APPEARANCE, density: 'compact', contrast: 'high', sidebar: 'icons' });
    expect(readAppearance()).toMatchObject({ density: 'compact', contrast: 'high', sidebar: 'icons' });

    window.localStorage.setItem('tfd.admin.appearance', JSON.stringify({ scheme: 'dark', density: 'tiny', contrast: 'high' }));
    expect(readAppearance()).toMatchObject({ scheme: 'dark', density: 'comfortable', contrast: 'high', sidebar: 'full' });
  });

  it('are applied as attributes the CSS keys on', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppearanceProvider>
        <BrandProvider>
          <AppearanceControls />
        </BrandProvider>
      </AppearanceProvider>,
    );
    await user.click(within(screen.getByRole('radiogroup', { name: 'Density' })).getByRole('radio', { name: 'Compact' }));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Contrast' })).getByRole('radio', { name: 'High' }));
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.contrast).toBe('high');

    await user.click(within(screen.getByRole('radiogroup', { name: 'Contrast' })).getByRole('radio', { name: 'Normal' }));
    expect(document.documentElement.dataset.contrast).toBeUndefined();
  });

  it('offers Auto beside light and dark', () => {
    renderWithProviders(
      <AppearanceProvider>
        <AppearanceControls />
      </AppearanceProvider>,
    );
    const scheme = screen.getByRole('radiogroup', { name: /appearance|theme/i });
    expect(within(scheme).getByRole('radio', { name: 'Auto' })).toBeInTheDocument();
  });

  it('saves several settings in one go without one undoing another', () => {
    function Apply() {
      const { appearance, updateAppearance } = useAppearance();
      return (
        <>
          <button type="button" onClick={() => updateAppearance({ scheme: 'dark', textSize: 'larger', density: 'compact' })}>
            apply
          </button>
          <output>{`${appearance.scheme} ${appearance.textSize} ${appearance.density}`}</output>
        </>
      );
    }
    render(
      <AppearanceProvider>
        <Apply />
      </AppearanceProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));
    expect(screen.getByRole('status')).toHaveTextContent('dark larger compact');
    expect(readAppearance()).toMatchObject({ scheme: 'dark', textSize: 'larger', density: 'compact' });
  });
});

describe('the icon rail', () => {
  it('narrows to icons from the menu under your name or the [ key, and every link keeps its name', async () => {
    await signInAs('manager@galabodatea.lk');
    const user = userEvent.setup();
    renderWithProviders(
      <AppearanceProvider>
        <Sidebar />
      </AppearanceProvider>,
    );
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('data-sidebar', 'full');

    // In the menu under the person's name.
    const name = useAuthStore.getState().user!.name;
    await user.click(screen.getByRole('button', { name: new RegExp(name) }));
    await user.click(await screen.findByRole('menuitem', { name: /collapse sidebar/i }));
    expect(nav).toHaveAttribute('data-sidebar', 'icons');
    expect(within(nav).getByRole('link', { name: /credit queues/i })).toHaveAttribute('title', 'Credit queues');
    expect(readAppearance().sidebar).toBe('icons');

    await user.keyboard('[[');
    expect(nav).toHaveAttribute('data-sidebar', 'full');
  });
});

describe('the shortcuts sheet', () => {
  it('opens on ?, but not while typing in a box', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <input aria-label="Box" />
        <ShortcutsDialog />
      </>,
    );
    await user.type(screen.getByLabelText('Box'), '?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(document.body);
    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(dialog).getByText('Approve the open request')).toBeInTheDocument();
  });
});

describe('counting figures', () => {
  it('shows the figure at once without animation', () => {
    render(<CountUp value={34} format={String} animate={false} />);
    expect(screen.getByText('34')).toBeInTheDocument();
  });

  it('counts up to the figure', async () => {
    render(<CountUp value={34} format={String} animate />);
    await waitFor(() => expect(screen.getByText('34')).toBeInTheDocument(), { timeout: 2000 });
  });
});

describe('the publish celebration', () => {
  it('is decoration only, and clears itself', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(<Celebration onDone={onDone} />);
    expect(container.querySelector('[data-celebration]')).toHaveAttribute('aria-hidden', 'true');
    act(() => vi.advanceTimersByTime(2000));
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('new-request alerts', () => {
  const item = (id: string): ActivityItem => ({
    id,
    kind: 'creditRequest.created',
    at: '2026-11-23T08:00:00Z',
    supplierId: 's1',
    supplierCode: '5708',
    supplierName: 'Saman Kumara',
    entityId: `req-${id}`,
    facility: 'advance',
    amount: 10000,
    unread: true,
  });

  afterEach(() => {
    setAlerts(DEFAULT_ALERTS);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('raises a desktop notification for a request that arrives while the console is hidden', async () => {
    const shown: Array<{ title: string; body?: string }> = [];
    class FakeNotification {
      static permission: NotificationPermission = 'granted';
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        shown.push({ title, body: options?.body });
      }
      close() {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

    let feed: ActivityFeed = { items: [item('1')], unread: 1, readUpTo: null };
    vi.spyOn(activityRepository, 'feed').mockImplementation(async () => feed);
    setAlerts({ sound: false, desktop: true });

    function Watch() {
      useRequestAlerts();
      return null;
    }
    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="*" element={<Watch />} />
      </Routes>,
    );
    // What was already there when the console opened is not announced.
    await waitFor(() => expect(queryClient.getQueryData(qk.activity)).toBeTruthy());
    // Let the watcher take its first look before anything new arrives.
    await act(async () => {});
    expect(shown).toHaveLength(0);

    feed = { items: [item('2'), item('1')], unread: 2, readUpTo: null };
    await act(() => queryClient.refetchQueries());
    await waitFor(() => expect(shown).toHaveLength(1));
    expect(shown[0]!.title).toBe('New request');
    expect(shown[0]!.body).toContain('Saman Kumara');
    vi.unstubAllGlobals();
  });

  it('saves the alerts with the other preferences, not before', async () => {
    await signInAs('manager@galabodatea.lk');
    const user = userEvent.setup();
    renderWithProviders(
      <AppearanceProvider>
        <ProfileScreen />
      </AppearanceProvider>,
    );
    await user.click(within(screen.getByRole('radiogroup', { name: /soft sound/i })).getByRole('radio', { name: 'On' }));
    // A draft until saved.
    expect(window.localStorage.getItem('tfd.admin.alerts')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apply these preferences?' });
    await user.click(within(dialog).getByRole('button', { name: 'Save preferences' }));
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('tfd.admin.alerts') ?? '{}')).toMatchObject({ sound: true }),
    );
  });
});
