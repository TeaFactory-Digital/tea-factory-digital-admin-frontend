/**
 * Deleting a console user waits three days (BACKEND-TODO #30), and can be undone until then.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersScreen } from '@/modules/users/UsersScreen';
import { userRepository } from '@/services/repositories/userRepository';
import { renderWithProviders, signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const REASON = 'Left the factory at the end of September.';

beforeEach(() => signOut());

async function rowFor(name: string) {
  const cell = await screen.findByText(name);
  return cell.closest('tr') as HTMLElement;
}

describe('deleting a console user', () => {
  it('schedules the deletion, shows the date, and can be cancelled', async () => {
    const user = userEvent.setup();
    await signInAs(ADMIN);
    renderWithProviders(<UsersScreen />, { route: '/users' });

    await user.click(
      within(await rowFor('Nadeeka Perera')).getByRole('button', { name: 'Delete' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), REASON);
    await user.click(within(dialog).getByRole('button', { name: /delete in 3 days/i }));
    // The second step: a confirmation before anything is sent.
    await user.click(await screen.findByRole('button', { name: /delete in 3 days/i }));

    const row = await rowFor('Nadeeka Perera');
    await waitFor(() => expect(within(row).getByText(/deletes on/i)).toBeInTheDocument());

    await user.click(within(row).getByRole('button', { name: /cancel deletion/i }));
    const undo = await screen.findByRole('dialog');
    await user.type(within(undo).getByRole('textbox'), 'Asked to stay on after all.');
    await user.click(within(undo).getByRole('button', { name: /keep the account/i }));
    await user.click(await screen.findByRole('button', { name: /keep the account/i }));

    await waitFor(async () =>
      expect(
        within(await rowFor('Nadeeka Perera')).queryByText(/deletes on/i),
      ).not.toBeInTheDocument(),
    );
  });

  it('refuses deleting your own account before anything is sent', async () => {
    await signInAs(ADMIN);
    await expect(
      userRepository.scheduleDeletion('usr-factoryadmin-1', REASON, {
        all: [],
        actingUserId: 'usr-factoryadmin-1',
      }),
    ).rejects.toMatchObject({ code: 'self-modification' });
  });
});
