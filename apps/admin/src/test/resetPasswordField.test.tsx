/**
 * The issued app password: in a password field, hidden until asked for, and exactly as the
 * supplier types it, with no dashes added.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { ResetPasswordDialog } from '@/modules/suppliers/ResetPasswordDialog';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('the issued password', () => {
  it('is a hidden password field showing the exact value', async () => {
    server.use(
      http.post('*/admin/suppliers/:id/credentials/reset', () =>
        HttpResponse.json({
          password: 'K7M4XPQR3',
          issuedAt: '2026-10-05T04:00:00.000Z',
          issuedByName: 'Nadeeka Perera',
          auditId: 'aud-1',
          sessionsEnded: 0,
        }),
      ),
    );
    const user = userEvent.setup();
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<ResetPasswordDialog supplierId="sup-1" supplierName="K.A. Sunil" />);

    await user.click(screen.getByRole('button', { name: /reset app password/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Passbook seen at the counter.');
    await user.click(within(dialog).getByRole('button', { name: /create a new password/i }));

    const field = await screen.findByLabelText('The new password');
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveValue('K7M4XPQR3');
    expect(screen.queryByText('K7M-4XP-QR3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(field).toHaveAttribute('type', 'text');
  });
});
