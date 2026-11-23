/**
 * Undo on a toast (24 November 2026): offered only for a change the opposite action puts
 * back exactly, and doing it puts it back.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InquiryDetailScreen } from '@/modules/inquiries/InquiryDetailScreen';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

function Shows({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.success('Saved', undefined, { label: 'Undo', onClick: onUndo })}>
      go
    </button>
  );
}

describe('the toast', () => {
  it('carries an Undo button that runs once and closes the toast', async () => {
    const user = userEvent.setup();
    let undone = 0;
    render(
      <ToastProvider>
        <Shows onUndo={() => (undone += 1)} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(undone).toBe(1);
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});

describe('undoing an assignment', () => {
  it('lets go of an inquiry just taken', async () => {
    const user = userEvent.setup();
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(
      <Routes>
        <Route path="/inquiries/:id" element={<InquiryDetailScreen />} />
      </Routes>,
      { route: '/inquiries/inq-1' },
    );

    await user.click(await screen.findByRole('button', { name: /assign to me/i }));
    expect(await screen.findByRole('button', { name: /unassign me/i })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: /assign to me/i })).toBeInTheDocument();
    expect(await screen.findByText('Nobody yet')).toBeInTheDocument();
  });
});
