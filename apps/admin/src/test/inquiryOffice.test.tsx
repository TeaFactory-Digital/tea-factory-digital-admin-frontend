import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InquiryDetailScreen } from '@/modules/inquiries/InquiryDetailScreen';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

const renderDetail = () =>
  renderWithProviders(
    <Routes>
      <Route path="/inquiries/:id" element={<InquiryDetailScreen />} />
    </Routes>,
    { route: '/inquiries/inq-1' },
  );

describe('the office side of an inquiry', () => {
  it('lets a clerk take it on, and keep a note the supplier never sees', async () => {
    const user = userEvent.setup();
    await signInAs('clerk@galabodatea.lk');
    renderDetail();

    expect(await screen.findByText('Nobody yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /assign to me/i }));
    expect(await screen.findByRole('button', { name: /unassign me/i })).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: /add note/i }),
      'Called, will call back Monday.',
    );
    await user.click(screen.getByRole('button', { name: /add note/i }));
    expect(await screen.findByText('Called, will call back Monday.')).toBeInTheDocument();
  });
});
