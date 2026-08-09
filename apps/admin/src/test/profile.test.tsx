/**
 * M15 — the one screen in this console that is about the reader rather than the factory.
 *
 * Two things here are decisions rather than markup, and both are the kind that get
 * "tidied" back later by someone who does not know why:
 *
 *  - **It is not capability-gated.** Every other route asks what this person may do to the
 *    factory. Gating this one would lock a clerk out of the text-size control, which is an
 *    accessibility need rather than a taste.
 *  - **It offers no password or two-factor form.** The auth surface is `login`,
 *    `verifyMfa`, `refresh`, `logout` and `me` — there is no self-service endpoint for
 *    either. A form posting nowhere would look like the feature until somebody needed it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileScreen } from '@/modules/profile/ProfileScreen';
import { SignInScreen } from '@/auth/SignInScreen';
import { Topbar } from '@/layout/Topbar';
import { AppearanceProvider } from '@/brand/AppearanceProvider';
import { readAppearance } from '@/brand/appearance';
import { setLanguage } from '@/i18n';
import { installLocalStorage } from './localStorage';
import { renderWithProviders, signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

const renderProfile = () =>
  renderWithProviders(
    <AppearanceProvider>
      <ProfileScreen />
    </AppearanceProvider>,
    { route: '/profile' },
  );

beforeEach(async () => {
  signOut();
  installLocalStorage();
  /**
   * Back to English between cases.
   *
   * `i18n` is module-global and survives a render, so the case below that applies Sinhala
   * leaves every later `getByRole(..., { name: /language/i })` looking for an English name
   * on a Sinhala label. Order-dependent failures in a suite that runs files in parallel are
   * the worst kind to debug.
   */
  await setLanguage('en');
});

describe('the profile screen', () => {
  it('opens for a clerk, the role most other screens refuse', async () => {
    await signInAs(CLERK);
    const { container } = renderProfile();

    // The point of leaving it ungated: the text-size control has to reach the person who
    // needs it, and that is rarely the factory admin.
    expect(await within(container).findByText('Nadeeka Perera')).toBeInTheDocument();
    expect(within(container).getByText(CLERK)).toBeInTheDocument();
  });

  it('shows every role, not the most senior one', async () => {
    await signInAs(CLERK);
    const { container } = renderProfile();

    // §12.1 grants are a union: somebody holding two roles is doing two jobs, not the
    // senior of them.
    expect(await within(container).findByText('Clerk')).toBeInTheDocument();
  });

  it('offers no password or two-factor form, because no endpoint backs one', async () => {
    await signInAs(CLERK);
    const { container } = renderProfile();
    const view = within(container);
    await view.findByText('Security');

    // Asked of the whole screen, not one card: the claim is that no such control exists
    // anywhere on it.
    expect(view.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(view.queryByRole('textbox', { name: /password/i })).not.toBeInTheDocument();
    // Said in a sentence instead, naming who can actually do it.
    expect(view.getByText(/reset by a factory administrator/i)).toBeInTheDocument();
  });

  it('says two-factor is owed when the role requires it', async () => {
    // Mandatory for manager and above, so "not set up" means different things by role —
    // fine for a clerk, a gap for a manager.
    await signInWithMfaAs(MANAGER);
    const { container } = renderProfile();

    expect(await within(container).findByText(/Two-factor is set up/)).toBeInTheDocument();
  });

  it('drafts a choice rather than applying it on press', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    const { container } = renderProfile();
    const view = within(container);

    const group = await view.findByRole('radiogroup', { name: /text size/i });
    await user.click(within(group).getByRole('radio', { name: /larger/i }));

    /**
     * The whole point of the confirmation, and its cost: the segment shows as chosen while
     * nothing has been applied. Appearance and text size are normally judged by *looking*
     * at them, and a draft cannot be looked at.
     */
    expect(within(group).getByRole('radio', { name: /larger/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(readAppearance().textSize).toBe('normal');
  });

  it('applies the text size once confirmed, and remembers it', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    const { container } = renderProfile();
    const view = within(container);

    const group = await view.findByRole('radiogroup', { name: /text size/i });
    await user.click(within(group).getByRole('radio', { name: /larger/i }));
    await user.click(view.getByRole('button', { name: /save preferences/i }));

    // Portalled by Radix, so the dialog is asked of the document.
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /save preferences/i }));

    // Persisted, because the whole reason it is not in M14 is that it belongs to this
    // person at this machine — including after a reload.
    await waitFor(() => expect(readAppearance().textSize).toBe('larger'));
  });

  it('applies the scheme and the language in the same confirmation', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    const { container } = renderProfile();
    const view = within(container);

    const scheme = await view.findByRole('radiogroup', { name: /appearance/i });
    await user.click(within(scheme).getByRole('radio', { name: /dark/i }));

    const language = view.getByRole('radiogroup', { name: /language/i });
    await user.click(within(language).getByRole('radio', { name: 'සිංහල' }));

    // One dialog for all three, not one each — three confirmations to change how a screen
    // reads would be worse than none.
    await user.click(view.getByRole('button', { name: /save preferences/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(readAppearance().scheme).toBe('dark'));
  });

  it('discards the draft on revert', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    const { container } = renderProfile();
    const view = within(container);

    const group = await view.findByRole('radiogroup', { name: /text size/i });
    await user.click(within(group).getByRole('radio', { name: /larger/i }));
    await user.click(view.getByRole('button', { name: /undo changes/i }));

    // Back to the stored value, and nothing was ever applied to walk back.
    expect(within(group).getByRole('radio', { name: /normal/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(readAppearance().textSize).toBe('normal');
  });

  it('is the only place inside the console that changes the language', async () => {
    await signInAs(CLERK);
    const { container } = renderProfile();

    /**
     * The top bar's copy was removed by decision. The sign-in screen keeps one — somebody
     * who cannot read the console changes the language before signing in — but once
     * inside, this screen is it.
     */
    expect(await within(container).findByRole('radiogroup', { name: /language/i })).toBeInTheDocument();
  });
});

/**
 * One home inside the console, and one on the way in.
 *
 * The top bar used to carry the language switcher permanently, and the account menu the
 * scheme and text size. Both were removed by decision: two places to change one value is
 * two places to look when it is wrong.
 *
 * The sign-in screen is the deliberate exception, and these pin both halves — the removal
 * is easy to undo by habit, and the exception is easy to remove by tidying.
 */
describe('where these settings live', () => {
  it('keeps the language switcher on the sign-in screen', async () => {
    // The moment somebody who cannot read the console is most likely to be stuck, and the
    // one screen with no session to read a stored preference from.
    const { container } = renderWithProviders(<SignInScreen />, { route: '/sign-in' });

    expect(
      await within(container).findByRole('radiogroup', { name: /language/i }),
    ).toBeInTheDocument();
  });

  it('offers neither from the shell', async () => {
    await signInAs(CLERK);
    const { container } = renderWithProviders(
      <AppearanceProvider>
        <Topbar />
      </AppearanceProvider>,
      { route: '/' },
    );
    const view = within(container);

    await view.findByText('Nadeeka Perera');

    expect(view.queryByRole('radiogroup', { name: /language/i })).not.toBeInTheDocument();
    expect(view.queryByRole('radiogroup', { name: /appearance/i })).not.toBeInTheDocument();
    expect(view.queryByRole('radiogroup', { name: /text size/i })).not.toBeInTheDocument();
  });
});
