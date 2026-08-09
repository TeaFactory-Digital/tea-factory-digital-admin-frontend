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
import { IDENTITY_CHECK_MIN } from '@tfd/domain';
import { ChangeRequestDetailScreen } from '@/modules/change-requests/ChangeRequestDetailScreen';
import { SupplierDetailScreen } from '@/modules/suppliers/SupplierDetailScreen';
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

/** `sup-1` is active in the seed; `sup-17` is the suspended one (`index % 17`). */
function renderSupplierDetail(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/suppliers/:id" element={<SupplierDetailScreen />} />
    </Routes>,
    { route: `/suppliers/${id}` },
  );
}

async function openSupplierDialog(
  user: ReturnType<typeof userEvent.setup>,
  id: string,
  trigger: string,
) {
  renderSupplierDetail(id);
  await user.click(await screen.findByRole('button', { name: trigger }));
  return screen.getByRole('dialog');
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

/**
 * The same chips on the two supplier acts that also demand a reason.
 *
 * Worth their own cases rather than trusting the shared component, because what is on
 * the chips is the part that carries the risk: these two notes are the office's only
 * account of why a supplier was locked out and how it knew who it was talking to.
 */
describe('supplier identity-check suggestions', () => {
  it('clears the identity-check floor and unblocks the reset', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openSupplierDialog(
      user,
      'sup-1',
      en['suppliers.action.resetPassword'],
    );

    const note = within(dialog).getByRole('textbox');
    const confirm = within(dialog).getByRole('button', {
      name: en['suppliers.resetPassword.confirm'],
    });
    expect(confirm).toBeDisabled();

    await user.click(
      within(dialog).getByRole('button', {
        name: en['suppliers.resetPassword.identitySuggest.book'],
      }),
    );

    expect(note).toHaveValue(en['suppliers.resetPassword.identitySuggest.book.text']);
    expect((note as HTMLTextAreaElement).value.length).toBeGreaterThanOrEqual(
      IDENTITY_CHECK_MIN,
    );
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  /**
   * The absence is the assertion.
   *
   * The dialog's own warning is that anyone who knows a supplier code can telephone and
   * ask, so a one-click *"confirmed by telephone"* would be the console offering the
   * weakest possible check as though it were policy — the opposite of what the field is
   * for. M9 offers that chip and should; this dialog must not.
   */
  it('offers no telephone chip, unlike the change-request queue', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openSupplierDialog(
      user,
      'sup-1',
      en['suppliers.action.resetPassword'],
    );

    for (const chip of ['book', 'nic', 'known'] as const) {
      expect(
        within(dialog).getByRole('button', {
          name: en[`suppliers.resetPassword.identitySuggest.${chip}`],
        }),
      ).toBeInTheDocument();
    }
    expect(
      within(dialog).queryByRole('button', {
        name: en['changeRequests.noteSuggest.approve.phone'],
      }),
    ).not.toBeInTheDocument();
  });

  /**
   * `known` stops on "recognised at the counter by". Completed it reads properly;
   * submitted untouched it is visibly a clerk who clicked and stopped, which is the one
   * thing somebody reading the audit log six months later needs to be able to see.
   */
  it('leaves the "known to staff" sentence open for the name', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openSupplierDialog(
      user,
      'sup-1',
      en['suppliers.action.resetPassword'],
    );

    const note = within(dialog).getByRole('textbox');
    await user.click(
      within(dialog).getByRole('button', {
        name: en['suppliers.resetPassword.identitySuggest.known'],
      }),
    );
    await user.type(note, ' S. Fernando.');

    expect(note).toHaveValue(
      `${en['suppliers.resetPassword.identitySuggest.known.text']} S. Fernando.`,
    );
  });
});

describe('supplier suspend and reactivate suggestions', () => {
  it('offers the suspension sentences when suspending', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openSupplierDialog(user, 'sup-1', en['suppliers.action.suspend']);

    const note = within(dialog).getByRole('textbox');
    const confirm = within(dialog).getByRole('button', { name: en['common.confirm'] });
    expect(confirm).toBeDisabled();

    await user.click(
      within(dialog).getByRole('button', {
        name: en['suppliers.statusSuggest.suspend.inactive'],
      }),
    );

    expect(note).toHaveValue(en['suppliers.statusSuggest.suspend.inactive.text']);
    await waitFor(() => expect(confirm).toBeEnabled());

    // A clerk suspending an account has no use for the sentence about it coming back.
    expect(
      within(dialog).queryByRole('button', {
        name: en['suppliers.statusSuggest.reactivate.resolved'],
      }),
    ).not.toBeInTheDocument();
  });

  it('offers the reactivation sentences when reactivating', async () => {
    await signInAs(CLERK);
    const user = userEvent.setup();
    const dialog = await openSupplierDialog(
      user,
      'sup-17',
      en['suppliers.action.reactivate'],
    );

    expect(
      within(dialog).getByRole('button', {
        name: en['suppliers.statusSuggest.reactivate.resolved'],
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', {
        name: en['suppliers.statusSuggest.suspend.inactive'],
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
