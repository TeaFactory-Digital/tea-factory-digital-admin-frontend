/**
 * A factory that saved a role before a capability joined its default keeps the old level: a
 * saved row replaces the default whole. Staging's clerk could not enter leaf for exactly that
 * reason (21 November 2026). The roles editor marks every cell that differs from the shipped
 * table and puts every drifted role back with one confirmed click.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_ROLE_MATRIX } from '@tfd/domain';
import { RoleMatrixView } from '@/modules/users/RoleMatrixView';
import { userRepository } from '@/services/repositories/userRepository';
import { renderWithProviders, signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';

beforeEach(() => signOut());

describe('restoring the standard permissions', () => {
  it('marks the drift and puts the clerk back to the shipped table', async () => {
    await signInAs(ADMIN);
    const { matrix } = await userRepository.roles();
    await userRepository.setRole('clerk', { ...matrix.clerk, deliveries: 'read' }, matrix);

    renderWithProviders(<RoleMatrixView />, { route: '/users?view=roles' });

    const table = await screen.findByRole('table', undefined, { timeout: 10_000 });
    const leafRow = within(table).getByRole('row', { name: /Leaf collection/ });
    expect(within(leafRow).getByText('Standard: Change')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restore the standard permissions' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Clerk');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore the standard permissions' }));

    await waitFor(async () => {
      expect((await userRepository.roles()).matrix.clerk).toEqual(DEFAULT_ROLE_MATRIX.clerk);
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Restore the standard permissions' })).not.toBeInTheDocument(),
    );
  }, 20_000);

  it('offers nothing to restore on the shipped table', async () => {
    await signInAs(ADMIN);
    renderWithProviders(<RoleMatrixView />, { route: '/users?view=roles' });
    await screen.findByRole('table', undefined, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: 'Restore the standard permissions' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Standard: /)).not.toBeInTheDocument();
  }, 20_000);
});
