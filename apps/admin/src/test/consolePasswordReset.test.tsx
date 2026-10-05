import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersScreen } from '@/modules/users/UsersScreen';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('resetting a console user’s password', () => {
  it('issues a one-time password, shown once in a password field', async () => {
    const user = userEvent.setup();
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(<UsersScreen />, { route: '/users' });

    const row = (await screen.findByText('Nadeeka Perera')).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /reset password/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Forgot it, asked at the office.');
    await user.click(within(dialog).getByRole('button', { name: /create a new password/i }));

    const field = await screen.findByLabelText('The new password');
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveValue('Tf7Kq2Xw9');
  });

  it('is not offered on your own row', async () => {
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(<UsersScreen />, { route: '/users' });
    const own = (await screen.findByText('factoryadmin@galabodatea.lk')).closest(
      'tr',
    ) as HTMLElement;
    expect(within(own).getByRole('button', { name: /reset password/i })).toBeDisabled();
  });
});
