import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastProvider } from '@/components/ui/Toast';
import { UserActionDialog } from '../modules/users/UserDialogs';

function renderWithI18n(ui: React.ReactElement) {
  const instance = i18next.createInstance();
  instance.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          common: {
            cancel: 'Cancel',
            confirm: 'Confirm',
            reason: 'Reason',
          },
          users: {
            suspendTitle: 'Suspend {{name}}?',
            suspendBody: 'This removes their access.',
            suspendConfirm: 'Suspend them',
            suspendDone: 'Suspended',
            suspendFailed: 'Failed',
            reasonHint: 'Write at least {{min}} characters.',
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

vi.mock('../modules/users/hooks', () => ({
  useCreateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLockoutContext: () => ({ actingUserId: 'me' }),
  useUpdateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserAction: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false }),
}));

describe('ConfirmDialog', () => {
  it('calls the confirm action and closes the dialog', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithI18n(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete this item?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('requires confirmation before performing a user action', async () => {
    const user = userEvent.setup();

    renderWithI18n(
      <UserActionDialog
        user={{ id: '1', name: 'Ada', email: 'ada@example.com', roles: [] }}
        action="suspend"
        users={[]}
        onClose={() => undefined}
      />,
    );

    const reasonInput = screen.getByLabelText('Reason');
    await user.type(reasonInput, 'Reason that is long enough');
    await user.click(screen.getByRole('button', { name: 'Suspend them' }));

    expect(screen.getByRole('button', { name: 'Suspend them' })).toBeInTheDocument();
  });
});
