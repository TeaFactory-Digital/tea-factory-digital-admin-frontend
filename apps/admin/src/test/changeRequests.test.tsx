/**
 * M9 end to end, against the mock API.
 *
 * These four cases are the acceptance criteria this milestone claims to meet:
 *
 *  - **AC-02** — approving changes the supplier's active value; rejecting leaves it
 *    untouched and shows the note.
 *  - **AC-06** — rejecting without a note is impossible.
 *  - **AC-09** — the decision appears in the audit trail with actor and before/after.
 *  - **AC-10 / BR-501** — nobody approves a record they created.
 *
 * They go through the real transport, the real store and the real screens; only
 * the server is a stand-in. That is deliberate — a test that stubbed the
 * repository would pass while the interceptor flattened every error code.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeRequestDetailScreen } from '@/modules/change-requests/ChangeRequestDetailScreen';
import { SupplierDetailScreen } from '@/modules/suppliers/SupplierDetailScreen';
import { changeRequestRepository } from '@/services/repositories/changeRequestRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { ApiError } from '@/services/api/errors';
import { renderWithProviders, signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

function renderDetail(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/change-requests/:id" element={<ChangeRequestDetailScreen />} />
    </Routes>,
    { route: `/change-requests/${id}` },
  );
}

beforeEach(() => {
  signOut();
});

describe('M9 approve (AC-02, AC-09)', () => {
  it('changes the supplier’s active savings rate and records an audit entry', async () => {
    await signInAs(CLERK);

    // `chg-2` is a savingsRate request raised by the supplier from the app.
    const before = await changeRequestRepository.get('chg-2');
    expect(before.type).toBe('savingsRate');
    expect(before.status).toBe('pending');
    const requested = before.requestedSavingsPerKg!;

    const supplierBefore = await supplierRepository.get(before.supplierId);
    expect(supplierBefore.savingsPerKg).not.toBe(requested);

    const after = await changeRequestRepository.approve('chg-2', {
      note: 'Rate change confirmed with the supplier at the counter.',
    });

    expect(after.status).toBe('approved');
    expect(after.decision?.decidedByName).toBe('Nadeeka Perera');

    // AC-02: the app's displayed value follows from this record.
    const supplierAfter = await supplierRepository.get(before.supplierId);
    expect(supplierAfter.savingsPerKg).toBe(requested);

    // AC-09: with actor and before/after — read as the manager, because §12.1
    // gives the clerk no audit access at all. That the clerk *cannot* read back
    // the entry they just caused is the matrix working, not a gap.
    await signInWithMfaAs(MANAGER);
    const audit = await auditRepository.forEntity('changeRequest', 'chg-2');
    const entry = audit.items.find((item) => item.action === 'changeRequest.approve');
    expect(entry).toBeDefined();
    expect(entry?.actorName).toBe('Nadeeka Perera');
    expect(entry?.before).toEqual({ status: 'pending' });
    expect(entry?.after).toMatchObject({ status: 'approved' });
  });

  it('leaves the value untouched when rejected, and keeps the note (AC-02)', async () => {
    await signInAs(CLERK);

    const before = await changeRequestRepository.get('chg-3');
    const supplierBefore = await supplierRepository.get(before.supplierId);

    const note = 'The requested method needs bank details on file first.';
    const after = await changeRequestRepository.reject('chg-3', { note });

    expect(after.status).toBe('rejected');
    expect(after.decision?.note).toBe(note);

    const supplierAfter = await supplierRepository.get(before.supplierId);
    expect(supplierAfter.paymentMethod).toBe(supplierBefore.paymentMethod);
    expect(supplierAfter.savingsPerKg).toBe(supplierBefore.savingsPerKg);
  });
});

describe('M9 refusals', () => {
  it('refuses a decision with no note, before it leaves the client (AC-06)', async () => {
    await signInAs(CLERK);

    // The repository guard, so a clerk is told in the dialog rather than after a
    // round trip. The server refuses it too — see the next case.
    await expect(changeRequestRepository.approve('chg-4', { note: 'ok' })).rejects.toMatchObject({
      code: 'note-required',
    });
  });

  it('refuses a decision with no note on the server too (AC-06)', async () => {
    await signInAs(CLERK);

    // Bypassing the client guard to prove the server is the authority.
    const endpoints = await import('@/services/endpoints/changeRequests');
    await expect(
      endpoints.changeRequestEndpoints.approve('chg-4', { note: 'no' }),
    ).rejects.toMatchObject({ code: 'note-required' });
  });

  it('refuses self-approval (BR-501, AC-10)', async () => {
    await signInAs(CLERK);

    // `chg-6` is the office-raised fixture — the clerk created it themselves.
    const officeRaised = await changeRequestRepository.get('chg-6');
    expect(officeRaised.channel).toBe('office');
    expect(officeRaised.createdById).toBe('usr-clerk-1');

    await expect(
      changeRequestRepository.approve('chg-6', {
        note: 'Approving my own request, which must not be allowed.',
      }),
    ).rejects.toMatchObject({ code: 'four-eyes-violation' });
  });

  it('refuses a second decision on an already-decided request', async () => {
    await signInAs(CLERK);

    await changeRequestRepository.approve('chg-5', {
      note: 'First decision, made by the clerk on duty.',
    });

    await expect(
      changeRequestRepository.approve('chg-5', {
        note: 'Second decision, which must be refused rather than overwrite.',
      }),
    ).rejects.toMatchObject({ code: 'already-decided' });
  });

  it('preserves the domain code rather than flattening it to the status (§17.7)', async () => {
    await signInAs(CLERK);

    const error = await changeRequestRepository
      .approve('chg-6', { note: 'A note long enough to pass client validation.' })
      .then(() => null)
      .catch((caught: unknown) => caught);

    // The bug this guards: `code: "409"` instead of `four-eyes-violation`, which
    // makes every specific banner in the console unreachable.
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('four-eyes-violation');
    expect((error as ApiError).status).toBe(409);
  });
});

describe('M9 detail screen', () => {
  it('shows current and requested side by side, and the decision controls', async () => {
    await signInAs(CLERK);
    const request = await changeRequestRepository.get('chg-3');
    renderDetail('chg-3');

    // Both values, not only the new one: the office is deciding whether to
    // *replace* something, and a screen showing one side asks them to approve a
    // change they cannot see.
    expect(await screen.findByText(request.currentSummary)).toBeInTheDocument();
    expect(await screen.findByText(request.requestedSummary)).toBeInTheDocument();
    expect(screen.getByText('Active now')).toBeInTheDocument();

    expect(await screen.findByRole('button', { name: /approve/i })).toBeEnabled();
    expect(await screen.findByRole('button', { name: /reject/i })).toBeEnabled();
  });

  it('explains the four-eyes rule instead of offering buttons that will fail', async () => {
    await signInAs(CLERK);
    renderDetail('chg-6');

    // The office-raised fixture: the clerk who created it sees why, not a form.
    expect(await screen.findByText(/cannot decide this one/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it('keeps the approve button disabled until the note is long enough (AC-06)', async () => {
    const user = userEvent.setup();
    await signInAs(CLERK);
    renderDetail('chg-3');

    await user.click(await screen.findByRole('button', { name: /approve/i }));

    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: /approve/i });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox'), 'Passbook checked at the counter.');
    await waitFor(() => expect(submit).toBeEnabled());
  });
});

describe('M2 supplier detail', () => {
  it('shows a masked account number and never the full one', async () => {
    await signInAs(CLERK);

    renderWithProviders(
      <Routes>
        <Route path="/suppliers/:id" element={<SupplierDetailScreen />} />
      </Routes>,
      { route: '/suppliers/sup-1' },
    );

    const masked = await screen.findByText(/•+\d{4}$/);
    expect(masked).toBeInTheDocument();
  });

  it('returns the full number only through the audited reveal (§20.4)', async () => {
    await signInAs(CLERK);

    const supplier = await supplierRepository.get('sup-1');
    expect(supplier.bankDetails?.accountNumber).toMatch(/•/);

    const revealed = await supplierRepository.revealBankDetails(
      'sup-1',
      'Verifying a bank rejection for the July payout run.',
    );
    expect(revealed.accountNumber).not.toMatch(/•/);
    // The reveal is only a control if it is recorded, and only visible if the id
    // comes back.
    expect(revealed.auditId).toMatch(/^aud-/);

    // Again read as the manager: a clerk may reveal a number and may not read the
    // log of who revealed it. Deliberate — the log is for the people reviewing.
    await signInWithMfaAs(MANAGER);
    const audit = await auditRepository.forEntity('supplier', 'sup-1');
    expect(audit.items.some((item) => item.action === 'supplier.bankDetails.reveal')).toBe(true);
  });

  it('gives a clerk no audit access at all (§12.1)', async () => {
    await signInAs(CLERK);
    await expect(auditRepository.forEntity('supplier', 'sup-1')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('refuses a reveal with no reason', async () => {
    await signInAs(CLERK);
    await expect(supplierRepository.revealBankDetails('sup-1', 'why')).rejects.toMatchObject({
      code: 'note-required',
    });
  });
});

describe('server-side capability enforcement', () => {
  it('leaves a manager unauthenticated until the second factor is verified', async () => {
    // MFA is mandatory for manager and above. A correct password alone must not
    // produce a usable session.
    await signInAs(MANAGER);
    await expect(supplierRepository.get('sup-1')).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('refuses a manager editing a supplier record, per §12.1', async () => {
    // The matrix gives the manager `R` on supplier records, not `W` — easy to get
    // wrong, because a manager outranks a clerk everywhere else. The console hides
    // the button; this proves the server does not depend on that.
    await signInWithMfaAs(MANAGER);

    await expect(supplierRepository.get('sup-1')).resolves.toBeTruthy();
    await expect(supplierRepository.update('sup-1', { name: 'Changed' })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('lets a manager decide a change request the clerk did not raise', async () => {
    await signInWithMfaAs(MANAGER);

    const decided = await changeRequestRepository.approve('chg-6', {
      note: 'Clerk raised this at the counter; verified against the passbook.',
    });
    expect(decided.status).toBe('approved');
    expect(decided.decision?.decidedByName).toBe('Ruwan Jayasuriya');
  });
});
