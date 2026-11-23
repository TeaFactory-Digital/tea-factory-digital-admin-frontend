/**
 * The inquiry screen kept simple (24 November 2026): closing and passing it up sit in the
 * conversation's header, apart from the send button; the facts row is gone from above the
 * messages; the reply chips are small pills; who has it is part of the supplier card.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { InquiryDetailScreen } from '@/modules/inquiries/InquiryDetailScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';

function renderInquiry() {
  renderWithProviders(
    <Routes>
      <Route path="/inquiries/:id" element={<InquiryDetailScreen />} />
    </Routes>,
    { route: '/inquiries/inq-1' },
  );
}

beforeEach(() => signOut());

describe('the inquiry screen', () => {
  it('puts closing and passing it up in the conversation header, not by the send button', async () => {
    await signInAs(CLERK);
    renderInquiry();
    const send = await screen.findByRole('button', { name: 'Send reply' });

    const conversation = screen.getByRole('heading', { name: 'Conversation' }).closest('header')!;
    expect(within(conversation).getByRole('button', { name: 'Pass to the manager' })).toBeInTheDocument();
    expect(within(conversation).getByRole('button', { name: 'Close unanswered' })).toBeInTheDocument();

    // The bar the send button sits in carries only the reply's own controls.
    const bar = send.parentElement!.parentElement!;
    expect(within(bar).queryByRole('button', { name: 'Close unanswered' })).not.toBeInTheDocument();
  });

  it('keeps who has it inside the supplier card', async () => {
    await signInAs(CLERK);
    renderInquiry();
    await screen.findByRole('button', { name: 'Send reply' });
    const supplier = screen.getByRole('heading', { name: 'Supplier' }).closest('section')!;
    expect(within(supplier).getByRole('heading', { name: 'Handling' })).toBeInTheDocument();
    expect(within(supplier).getByRole('button', { name: /assign to me/i })).toBeInTheDocument();
  });

  it('offers the reply sentences as small pills', async () => {
    await signInAs(CLERK);
    renderInquiry();
    const chip = await screen.findByRole('button', { name: 'Checking' });
    expect(chip).toHaveClass('rounded-full');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });
});
