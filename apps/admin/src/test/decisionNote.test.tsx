/**
 * The ready-made decision notes.
 *
 * AC-06 makes a note compulsory, which is what makes the *quality* of the note a
 * product problem rather than a nicety: a rule that forces ten characters out of a
 * clerk forty times a day gets ten characters. These cases pin the three behaviours
 * that decide whether the chips help or get in the way —
 *
 *  - a chip fills the note well past the ten-character floor, so the decision
 *    button it was blocking becomes usable;
 *  - a chip never destroys what the clerk already typed, and two chips compose;
 *  - the same chip takes its sentence back out, because a misclick has to be
 *    undoable by the control that caused it.
 *
 * `toggleNoteSuggestion` is tested directly as well as through the screen: the
 * whitespace tidy-up after a removal is the part most likely to rot, and a DOM test
 * would only notice it as a stray double space nobody asserts on.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeRequestDetailScreen } from '@/modules/change-requests/ChangeRequestDetailScreen';
import { toggleNoteSuggestion } from '@/lib/noteSuggestion';
import { en } from '@/i18n/locales/en';
import { renderWithProviders, signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';

function renderDetail(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/change-requests/:id" element={<ChangeRequestDetailScreen />} />
    </Routes>,
    { route: `/change-requests/${id}` },
  );
}

/** Opens the reject dialog on a request the signed-in clerk did not raise. */
async function openRejectDialog(user: ReturnType<typeof userEvent.setup>) {
  renderDetail('chg-2');
  const reject = await screen.findByRole('button', { name: en['changeRequests.reject'] });
  await user.click(reject);
  return screen.getByRole('dialog');
}

beforeEach(() => {
  signOut();
});

describe('decision note suggestions', () => {
  it('fills the note past the ten-character floor and unblocks the button', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openRejectDialog(user);

    const note = within(dialog).getByRole('textbox');
    const confirm = within(dialog).getAllByRole('button', {
      name: en['changeRequests.reject'],
    })[0];
    expect(confirm).toBeDisabled();

    await user.click(
      within(dialog).getByRole('button', {
        name: en['changeRequests.noteSuggest.reject.mismatch'],
      }),
    );

    expect(note).toHaveValue(en['changeRequests.noteSuggest.reject.mismatch.text']);
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  it('appends to what the clerk typed rather than replacing it', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openRejectDialog(user);

    const note = within(dialog).getByRole('textbox');
    await user.type(note, 'Spoke to Kamala at the counter.');

    await user.click(
      within(dialog).getByRole('button', {
        name: en['changeRequests.noteSuggest.reject.document'],
      }),
    );

    expect(note).toHaveValue(
      `Spoke to Kamala at the counter. ${en['changeRequests.noteSuggest.reject.document.text']}`,
    );
  });

  it('takes the sentence back out when the same chip is pressed again', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openRejectDialog(user);

    const note = within(dialog).getByRole('textbox');
    const chip = within(dialog).getByRole('button', {
      name: en['changeRequests.noteSuggest.reject.mismatch'],
    });

    await user.click(chip);
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'true'));

    await user.click(chip);
    expect(note).toHaveValue('');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers the approve sentences under Approve and the reject ones under Reject', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();

    renderDetail('chg-2');
    await user.click(
      await screen.findByRole('button', { name: en['changeRequests.approve'] }),
    );

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', {
        name: en['changeRequests.noteSuggest.approve.passbook'],
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', {
        name: en['changeRequests.noteSuggest.reject.mismatch'],
      }),
    ).not.toBeInTheDocument();
  });
});

describe('toggleNoteSuggestion', () => {
  it('starts the note when it is empty', () => {
    expect(toggleNoteSuggestion('', 'Passbook checked.')).toBe('Passbook checked.');
    expect(toggleNoteSuggestion('   ', 'Passbook checked.')).toBe('Passbook checked.');
  });

  it('joins onto existing text with a single space', () => {
    expect(toggleNoteSuggestion('Seen at the counter.', 'Passbook checked.')).toBe(
      'Seen at the counter. Passbook checked.',
    );
  });

  it('removes the sentence without leaving the gap behind', () => {
    const note = 'Seen at the counter. Passbook checked. Filed today.';
    expect(toggleNoteSuggestion(note, 'Passbook checked.')).toBe(
      'Seen at the counter. Filed today.',
    );
  });

  it('keeps the clerk’s own line breaks when removing', () => {
    const note = 'Passbook checked.\nSecond line the clerk wrote.';
    expect(toggleNoteSuggestion(note, 'Passbook checked.')).toBe(
      'Second line the clerk wrote.',
    );
  });
});
