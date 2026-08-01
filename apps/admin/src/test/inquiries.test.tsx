/**
 * M10 against the mock API.
 *
 * The smallest module in the console and the one with the clearest job: every
 * `pending` in the supplier's app is a queue here, and this is the last of them.
 * So the suite is about the three things that make a message queue trustworthy
 * rather than merely present:
 *
 *  - **Answering and closing are different acts.** A reply is what the supplier
 *    reads; a closure is the office filing something that needed no answer. If the
 *    two collapsed into one "resolve", the number §19.3's channel-shift KPI wants —
 *    how many suppliers we actually answered — could not be recovered.
 *  - **`already-decided`** — two clerks working one inbox is the normal case, and a
 *    second reply would replace an answer the supplier has already read.
 *  - **§12.1's unusual row** — inquiries are `A` for the clerk and `R` for the
 *    manager. The manager is oversight here, not a second pair of hands, and that
 *    is the opposite of every money module.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { inquiryStatusForApp } from '@tfd/domain';
import { InquiryDetailScreen } from '@/modules/inquiries/InquiryDetailScreen';
import { inquiryRepository } from '@/services/repositories/inquiryRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { renderWithProviders, signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const ACCOUNTANT = 'accountant@galabodatea.lk';

const REPLY =
  'We checked the 12th and found a second weighing of 96 kg that had not been entered. It is on your account now.';

/** Fixture ids, named so a case cannot pass by finding nothing. */
const OPEN = 'inq-1';
const ANSWERED = 'inq-5';
const CLOSED_UNANSWERED = 'inq-6';
const TEST_MESSAGE = 'inq-2';

function renderDetail(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/inquiries/:id" element={<InquiryDetailScreen />} />
    </Routes>,
    { route: `/inquiries/${id}` },
  );
}

beforeEach(() => {
  signOut();
});

describe('M10 answering', () => {
  it('records the reply and moves the message to answered (AC-09)', async () => {
    await signInAs(CLERK);

    const before = await inquiryRepository.get(OPEN);
    expect(before.status).toBe('open');
    expect(before.reply).toBeNull();

    const after = await inquiryRepository.reply(OPEN, { body: REPLY });

    expect(after.status).toBe('resolved');
    expect(after.reply?.body).toBe(REPLY);
    expect(after.reply?.repliedByName).toBe('Nadeeka Perera');
    // Answered, not closed — the closure fields stay empty, because the two are
    // different outcomes and the record has to be able to tell them apart.
    expect(after.closedAt).toBeNull();
    expect(after.closureNote).toBeNull();

    await signInWithMfaAs(MANAGER);
    const audit = await auditRepository.forEntity('inquiry', OPEN);
    const entry = audit.items.find((item) => item.action === 'inquiry.reply');
    expect(entry).toBeDefined();
    expect(entry?.actorName).toBe('Nadeeka Perera');
    expect(entry?.before).toEqual({ status: 'open' });
    expect(entry?.after).toMatchObject({ status: 'resolved' });
  });

  it('closes a message that needed no answer, with the reason kept', async () => {
    await signInAs(CLERK);
    const note = 'Duplicate of the message answered on the 4th.';

    const after = await inquiryRepository.close(TEST_MESSAGE, { note });

    expect(after.status).toBe('closed');
    expect(after.closureNote).toBe(note);
    expect(after.closedByName).toBe('Nadeeka Perera');
    // Closed is not answered: nothing was sent to the supplier.
    expect(after.reply).toBeNull();
  });

  it('keeps answered and closed distinguishable in the record', async () => {
    await signInAs(CLERK);

    const answered = await inquiryRepository.get(ANSWERED);
    const closed = await inquiryRepository.get(CLOSED_UNANSWERED);

    expect(answered.status).toBe('resolved');
    expect(answered.reply).not.toBeNull();
    expect(answered.closureNote).toBeNull();

    expect(closed.status).toBe('closed');
    expect(closed.reply).toBeNull();
    expect(closed.closureNote).not.toBeNull();
  });
});

describe('M10 refusals', () => {
  it('refuses a reply too short to be an answer, on the client and the server', async () => {
    await signInAs(CLERK);

    // A reply is held to a longer minimum than a decision note, because it *is*
    // the answer rather than a justification filed beside one.
    await expect(inquiryRepository.reply(OPEN, { body: 'Yes.' })).rejects.toMatchObject({
      code: 'note-required',
    });

    const endpoints = await import('@/services/endpoints/inquiries');
    await expect(
      endpoints.inquiryEndpoints.reply(OPEN, { body: 'Come to the office' }),
    ).rejects.toMatchObject({ code: 'note-required' });
  });

  it('refuses closing with no reason', async () => {
    await signInAs(CLERK);
    await expect(inquiryRepository.close(OPEN, { note: 'spam' })).rejects.toMatchObject({
      code: 'note-required',
    });

    const endpoints = await import('@/services/endpoints/inquiries');
    await expect(
      endpoints.inquiryEndpoints.close(OPEN, { note: 'dup' }),
    ).rejects.toMatchObject({ code: 'note-required' });
  });

  it('refuses a second answer to a message somebody else already answered', async () => {
    await signInAs(CLERK);

    await expect(inquiryRepository.reply(ANSWERED, { body: REPLY })).rejects.toMatchObject({
      code: 'already-decided',
    });
  });

  it('refuses answering a message that was closed unanswered', async () => {
    // The check is "is this finished with", not "has it been replied to" — a check
    // written as `status === 'resolved'` would let a closed message be answered.
    await signInAs(CLERK);

    await expect(
      inquiryRepository.reply(CLOSED_UNANSWERED, { body: REPLY }),
    ).rejects.toMatchObject({ code: 'already-decided' });
  });

  it('refuses closing something already closed', async () => {
    await signInAs(CLERK);
    await expect(
      inquiryRepository.close(CLOSED_UNANSWERED, { note: 'Closing it a second time.' }),
    ).rejects.toMatchObject({ code: 'already-decided' });
  });
});

describe('M10 permissions (§12.1)', () => {
  it('lets the clerk answer and gives the manager read only', async () => {
    /**
     * The opposite of every money module, and deliberate: answering a supplier is
     * counter work, and a manager reading the queue is oversight. Requiring a
     * manager to release a reply would put a day between a question and its answer
     * to guard against a risk — money moving — that an inquiry does not carry.
     */
    await signInWithMfaAs(MANAGER);
    await expect(inquiryRepository.list()).resolves.toBeTruthy();
    await expect(inquiryRepository.reply(OPEN, { body: REPLY })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('gives the accountant no access to inquiries at all', async () => {
    await signInAs(ACCOUNTANT);
    await expect(inquiryRepository.list()).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('M10 status vocabulary (§21.18)', () => {
  it('maps the console’s three states onto the app’s three words in one place', () => {
    /**
     * The console says open/resolved/closed; the app's `Inquiry.status` has only
     * `pending | approved | rejected`. The mapping is imprecise — a closed message
     * is not one that was *rejected* — and that imprecision is exactly what §21.18
     * is being asked to resolve. Recording it in one function means the answer
     * changes one line instead of every consumer.
     */
    expect(inquiryStatusForApp('open')).toBe('pending');
    expect(inquiryStatusForApp('resolved')).toBe('approved');
    expect(inquiryStatusForApp('closed')).toBe('rejected');
  });
});

describe('M10 detail screen', () => {
  it('shows the question and offers both outcomes', async () => {
    await signInAs(CLERK);
    const inquiry = await inquiryRepository.get(OPEN);
    renderDetail(OPEN);

    expect(await screen.findByText(inquiry.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reply$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /close unanswered/i })).toBeEnabled();
  });

  it('shows the answer and says whether a notification went to the phone', async () => {
    await signInAs(CLERK);
    renderDetail(ANSWERED);

    expect(await screen.findByText(/The answer/i)).toBeInTheDocument();
    // M13 now exists, and `inquiryReplied` is on by default for this tenant — so the
    // screen must say a notification *was* sent. It used to assert the opposite, which
    // was true until M13 landed and is exactly the kind of copy that quietly becomes a
    // lie. A clerk who believes a message was pushed to the
    // supplier's phone is a clerk who does not follow up.
    expect(screen.getByText(/A notification was sent to their phone/i)).toBeInTheDocument();
    // Nothing to do on a message already answered.
    expect(screen.queryByRole('button', { name: /^reply$/i })).not.toBeInTheDocument();
  });

  it('keeps the send button disabled until the reply is long enough', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    renderDetail(OPEN);

    await user.click(await screen.findByRole('button', { name: /^reply$/i }));

    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: /send reply/i });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox'), REPLY);
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('puts the question in front of the person answering it', async () => {
    // A reply written from memory of the previous screen is how a supplier gets an
    // answer to somebody else's question.
    const user = userEvent.setup();
    await signInAs(CLERK);
    const inquiry = await inquiryRepository.get(OPEN);
    renderDetail(OPEN);

    await user.click(await screen.findByRole('button', { name: /^reply$/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(inquiry.message)).toBeInTheDocument();
  });
});
