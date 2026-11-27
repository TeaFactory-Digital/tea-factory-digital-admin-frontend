/**
 * Arranging the dashboard (27 November 2026): order and hidden cards, per person, in this
 * browser, changed only in "Customise" so an ordinary click is never a drag.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardScreen } from '@/modules/dashboard/DashboardScreen';
import { CARD_IDS, DEFAULT_LAYOUT, readLayout } from '@/modules/dashboard/layout';
import { useAuthStore } from '@/auth/authStore';
import { installLocalStorage } from './localStorage';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(async () => {
  signOut();
  installLocalStorage();
  await signInAs('manager@galabodatea.lk');
});

const userId = () => useAuthStore.getState().user!.id;
const slots = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-dashboard-slot]')]
    .map((slot) => slot.dataset.dashboardSlot)
    .filter((id) => (CARD_IDS as readonly (string | undefined)[]).includes(id));

describe('the saved layout', () => {
  it('keeps what it can of a layout from another build', () => {
    window.localStorage.setItem(
      `tfd.admin.dashboardLayout.${userId()}`,
      JSON.stringify({ cards: ['queues', 'gone', 'today', 'queues'], hiddenCards: ['alerts', 'gone'] }),
    );
    const layout = readLayout(userId());
    // Known ids in the saved order, the unknown one dropped, a duplicate once, and every
    // missing card back after the default neighbour it followed.
    expect(layout.cards[0]).toBe('queues');
    expect(layout.cards.indexOf('queues')).toBeLessThan(layout.cards.indexOf('today'));
    // 'content' followed 'queues' in the default, so that is where it comes back.
    expect(layout.cards[1]).toBe('content');
    expect([...layout.cards].sort()).toEqual([...CARD_IDS].sort());
    expect(layout.hiddenCards).toEqual(['alerts']);
    expect(layout.kpis).toEqual(DEFAULT_LAYOUT.kpis);
  });

  it('is per person: another account on this computer starts from the default', () => {
    window.localStorage.setItem(`tfd.admin.dashboardLayout.${userId()}`, JSON.stringify({ hiddenCards: ['alerts'] }));
    expect(readLayout('someone-else')).toEqual(DEFAULT_LAYOUT);
  });
});

describe('customising', () => {
  it('hides a card, says how many are hidden, and puts everything back on reset', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DashboardScreen />);
    await screen.findByRole('button', { name: 'Customise' });
    // No handles until asked for: the cards are the dashboard as ever.
    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Customise' }));
    await user.click(screen.getByRole('button', { name: 'Hide Needs attention' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(slots(container)).not.toContain('alerts');
    expect(screen.getByRole('button', { name: /Customise.*1 hidden/ })).toBeInTheDocument();
    expect(readLayout(userId()).hiddenCards).toEqual(['alerts']);

    await user.click(screen.getByRole('button', { name: /Customise/ }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(slots(container)).toEqual([...CARD_IDS]);
  });

  it('moves a card with the keyboard alone', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DashboardScreen />);
    await user.click(await screen.findByRole('button', { name: 'Customise' }));

    const handle = screen.getByRole('button', { name: 'Move Needs attention' });
    handle.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');

    await waitFor(() => expect(slots(container).indexOf('alerts')).toBeLessThan(CARD_IDS.indexOf('alerts')));
    expect(readLayout(userId()).cards.indexOf('alerts')).toBeLessThan(CARD_IDS.indexOf('alerts'));
    // And the move was announced, in words.
    expect(within(document.body).getAllByText(/Needs attention/).length).toBeGreaterThan(0);
  });
});
