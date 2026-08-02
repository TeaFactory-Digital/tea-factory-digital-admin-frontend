import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { ToastProvider } from '@/components/ui/Toast';
import { UserDialog } from '../modules/users/UserDialogs';

function renderWithI18n(ui: React.ReactElement) {
  const instance = i18next.createInstance();
  instance.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          common: {
            cancel: 'Cancel',
            save: 'Save',
          },
          validation: {
            required: 'This is required',
            email: 'Enter a valid email address',
            tooLong: 'That is too long',
          },
          users: {
            inviteTitle: 'Invite a user',
            inviteBody: 'Enter details below.',
            invite: 'Send invitation',
            field: {
              name: 'Name',
              email: 'Email address',
              emailHint: 'Work email',
              roles: 'Roles',
              rolesHint: 'Select at least one role',
            },
            role: {
              weigher: 'Weigher',
              clerk: 'Clerk',
              manager: 'Manager',
            },
          },
        },
      },
    },
    interpolation: { escapeValue: false },
  });

  return render(
    <I18nextProvider i18n={instance}>
      <ToastProvider>{ui}</ToastProvider>
    </I18nextProvider>,
  );
}

const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../modules/users/hooks', () => ({
  useCreateUser: () => ({ mutateAsync: mockCreate, isPending: false }),
  useLockoutContext: () => ({ actingUserId: 'me' }),
  useUpdateUser: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useUserAction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('UserDialog text field validation', () => {
  it('displays email format validation error when invalid email is typed', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <UserDialog open user={null} users={[]} onClose={vi.fn()} />,
    );

    const nameInput = screen.getByLabelText('Name');
    const emailInput = screen.getByLabelText('Email address');

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears email validation error when valid email is entered', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <UserDialog open user={null} users={[]} onClose={vi.fn()} />,
    );

    const emailInput = screen.getByLabelText('Email address');

    await user.type(emailInput, 'invalid-email');
    await user.tab();
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();

    await user.clear(emailInput);
    await user.type(emailInput, 'valid@factory.com');
    await user.tab();

    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
    expect(emailInput).not.toHaveAttribute('aria-invalid', 'true');
  });
});
