/**
 * The welcome tour (24 November 2026): greets each person once, steps through four short
 * screens, and opens again on request.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeTour } from '@/layout/WelcomeTour';
import { openTour, tourSeen } from '@/layout/tourEvent';
import { useAuthStore } from '@/auth/authStore';
import { renderWithProviders, signInAs, signOut } from './render';
import { installLocalStorage } from './localStorage';

const CLERK = 'clerk@galabodatea.lk';

beforeEach(() => {
  signOut();
  // A real store: without one the tour counts as seen (a private window is never greeted
  // on every page load), which is the right default and hides the first-visit path.
  installLocalStorage();
});

describe('the welcome tour', () => {
  it('greets a first sign-in, steps through, and is not shown again', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    const me = useAuthStore.getState().user!;
    window.localStorage.removeItem(`tfd.admin.tour.seen.${me.id}`);
    renderWithProviders(<WelcomeTour />);

    expect(await screen.findByRole('dialog', { name: `Welcome, ${me.name}` })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'The queues are in the sidebar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tourSeen(me.id)).toBe(true);
  });

  it('stays closed for someone who has seen it, and opens again on request', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    const me = useAuthStore.getState().user!;
    window.localStorage.setItem(`tfd.admin.tour.seen.${me.id}`, '1');
    renderWithProviders(<WelcomeTour />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => openTour());
    expect(await screen.findByText('Step 1 of 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
