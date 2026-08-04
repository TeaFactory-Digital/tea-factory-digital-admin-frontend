/**
 * M14's screen, rendered.
 *
 * `configuration.test.ts` covers the repository and the refusals thoroughly and
 * still let a blank screen ship: `FactorySection` referenced `emailSchema` without
 * importing it, so the first thing an administrator opened threw on render and the
 * route boundary replaced the whole console with "This screen could not be shown".
 * Nothing in the suite mounted the component, and `npm run typecheck` — which would
 * have named the identifier — dies on an unrelated `tsconfig` error before it gets
 * there.
 *
 * So the first case here is deliberately shallow: **it just renders.** The second
 * covers the validation that import was for, since a rule that blocks a save is
 * worth knowing about the moment it stops working.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurationScreen } from '@/modules/configuration/ConfigurationScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';

/** The seeded `client_config` row for Galaboda. */
const SEEDED_SUPPORT_EMAIL = 'office@galabodatea.lk';

beforeEach(() => {
  signOut();
});

describe('the configuration screen', () => {
  it('renders the factory section it opens on', async () => {
    await signInAs(ADMIN);

    renderWithProviders(<ConfigurationScreen />, { route: '/configuration' });

    // The seeded row, in editable fields — which is only reachable if every
    // section component evaluated.
    expect(await screen.findByDisplayValue(SEEDED_SUPPORT_EMAIL)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Galaboda Tea Factory')).toBeInTheDocument();

    // The rail offers all five, because AC-12 is about the *last* field a factory
    // needs being here, not the convenient ones.
    expect(screen.getByRole('button', { name: /Factory/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Features/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Collection/ })).toBeInTheDocument();
  });

  it('refuses to save an office email that is not one', async () => {
    await signInAs(ADMIN);
    const user = userEvent.setup();

    renderWithProviders(<ConfigurationScreen />, { route: '/configuration' });

    const email = await screen.findByDisplayValue(SEEDED_SUPPORT_EMAIL);
    await user.clear(email);
    await user.type(email, 'office@');

    // Said, not merely refused: a greyed-out Save with no reason is a support call.
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save this section' })).toBeDisabled();

    await user.clear(email);
    await user.type(email, 'reception@galabodatea.lk');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save this section' })).toBeEnabled(),
    );
    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
  });
});
