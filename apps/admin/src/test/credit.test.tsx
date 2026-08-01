/**
 * M7 against the mock API.
 *
 * The module lends money against leaf, so the suite is mostly about the four ways
 * it must refuse to:
 *
 *  - **`stale-eligibility`** (BR-310) — the ceiling moved while the queue was open.
 *    The load-bearing one, and the only refusal in the console that can be caused
 *    by somebody else doing their job correctly: a weigher recording leaf raises an
 *    advance ceiling, and the approver's screen is instantly out of date.
 *  - **`over-ceiling`** — eligibility that never moved, against an amount that was
 *    never inside it.
 *  - **`four-eyes-violation`** (BR-501) — credit is money, and money takes two people.
 *  - **`note-required`** (AC-06) — a decision nobody can reconstruct.
 *  - **`feature-disabled`** (AC-07) — a facility this factory does not sell is
 *    refused by the **endpoint**, not only hidden from a filter.
 *
 * And the criterion the whole module exists for: **AC-05**, the eligibility figures
 * and their working being the same ones the supplier's app showed them. That is
 * asserted here as an identity — the ceiling equals the arithmetic the panel prints
 * — because a test comparing the console's number to the console's number would
 * pass however wrong both were.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  REQUIRED_MONTHS_OF_HISTORY,
  buildCreditEligibility,
  colomboDayOf,
  round2,
} from '@tfd/domain';
import { CreditRequestDetailScreen } from '@/modules/credit/CreditRequestDetailScreen';
import { creditRepository } from '@/services/repositories/creditRepository';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { useAuthStore } from '@/auth/authStore';
import { renderWithProviders, signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const WEIGHER = 'weigher@galabodatea.lk';
const ACCOUNTANT = 'accountant@galabodatea.lk';

const NOTE = 'Checked against the leaf already weighed this month at the counter.';

/**
 * The fixture ids, and what each is for. Named here rather than rediscovered in
 * every case, because a test that searches the queue for "a row that is over the
 * ceiling" passes vacuously on the day the fixture stops containing one.
 */
const WITHIN_CEILING = 'crd-1'; // advance, comfortably inside
const OVER_CEILING = 'crd-4'; // advance, asks for more than is available
const OFFICE_RAISED = 'crd-6'; // loan, raised by the clerk — four-eyes
const SHORT_HISTORY = 'crd-9'; // loan from a supplier with no settled months
const ALREADY_APPROVED = 'crd-13';

function renderDetail(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/credit/:id" element={<CreditRequestDetailScreen />} />
    </Routes>,
    { route: `/credit/${id}` },
  );
}

beforeEach(() => {
  signOut();
});

describe('M7 eligibility (AC-05)', () => {
  it('prints a ceiling that equals its own working', async () => {
    await signInAs(CLERK);
    const request = await creditRepository.get(WITHIN_CEILING);
    const { eligibility } = request;

    expect(request.facility).toBe('advance');
    expect(eligibility.eligible).toBe(true);

    /**
     * An advance is the last settled rate × **this** month's kilos. Asserting the
     * identity rather than a fixed number is the point: the figure changes every
     * time leaf is recorded, and a hardcoded expectation would only prove the
     * fixture had not moved.
     */
    expect(eligibility.lastSettledRatePerKg).not.toBeNull();
    expect(eligibility.pricedKgs).not.toBeNull();
    expect(eligibility.ceiling).toBe(
      round2(eligibility.lastSettledRatePerKg! * eligibility.pricedKgs!),
    );

    // And the headroom is the ceiling less what is already drawn.
    expect(eligibility.available).toBe(
      round2(eligibility.ceiling - eligibility.outstanding),
    );

    // An advance is against leaf in the shed, not a track record — so the history
    // requirement is `0`, which is "not required" rather than "unset".
    expect(eligibility.requiredMonths).toBe(0);
  });

  it('agrees with the shared implementation the app also calls', async () => {
    await signInAs(CLERK);
    const request = await creditRepository.get('crd-2');
    expect(request.facility).toBe('loan');

    /**
     * The console re-derives from `@tfd/domain` and must land on the same number.
     *
     * This is the closest a mock-backed suite can get to AC-05: the criterion is
     * that the console and the app's eligibility endpoint agree byte for byte, and
     * they can only be *made* to agree by both calling this function. If the API
     * ever grows its own copy, the identity below is what breaks.
     */
    const { eligibility } = request;
    expect(eligibility.limitMultiplier).not.toBeNull();
    expect(eligibility.averageMonthlyIncome).not.toBeNull();
    expect(eligibility.ceiling).toBe(
      round2(eligibility.averageMonthlyIncome! * eligibility.limitMultiplier!),
    );
    expect(eligibility.monthsOfHistory).toBeGreaterThanOrEqual(REQUIRED_MONTHS_OF_HISTORY);
  });

  it('explains why a supplier with no history cannot borrow, rather than showing a bare zero', async () => {
    await signInAs(CLERK);
    const request = await creditRepository.get(SHORT_HISTORY);

    expect(request.eligibility.eligible).toBe(false);
    expect(request.eligibility.ceiling).toBe(0);
    expect(request.eligibility.monthsOfHistory).toBeLessThan(REQUIRED_MONTHS_OF_HISTORY);
    // A key, not a sentence — the console localizes (BR-110).
    expect(request.eligibility.reasonKey).toBe('credit.reason.shortHistory');
  });

  it('recomputes on every read instead of serving what was stored', async () => {
    // Read as the clerk, move the leaf as the weigher, read again. An advance
    // ceiling that did not change would mean the row is serving a snapshot.
    await signInAs(CLERK);
    const before = await creditRepository.get(WITHIN_CEILING);

    await signInAs(WEIGHER);
    await deliveryRepository.commit({
      date: colomboDayOf(new Date()),
      collectionPoint: 'MAKADURA',
      batchId: 'test-credit-recompute',
      rows: [{ supplierId: before.supplierId, kgs: 90 }],
    });

    await signInAs(CLERK);
    const after = await creditRepository.get(WITHIN_CEILING);

    expect(after.eligibility.pricedKgs).toBeGreaterThan(before.eligibility.pricedKgs!);
    expect(after.eligibility.ceiling).toBeGreaterThan(before.eligibility.ceiling);
  });
});

describe('M7 approve', () => {
  it('raises the supplier’s balance and records what it was decided against (AC-09)', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get(WITHIN_CEILING);
    const supplierBefore = await supplierRepository.get(request.supplierId);

    const decided = await creditRepository.approve(
      WITHIN_CEILING,
      { note: NOTE, ceilingSeen: request.eligibility.ceiling },
      { amount: request.amount, available: request.eligibility.available },
    );

    expect(decided.status).toBe('approved');
    expect(decided.decision?.decidedByName).toBe('Ruwan Jayasuriya');

    /**
     * §11.3: an approved advance is a balance the supplier owes, and it comes back
     * as a `deductions.advance` line on the next bill. Without this write the
     * module would be a queue that decides things and changes nothing.
     */
    const supplierAfter = await supplierRepository.get(request.supplierId);
    expect(supplierAfter.creditBalances.advance).toBe(
      round2(supplierBefore.creditBalances.advance + request.amount),
    );

    const audit = await auditRepository.forEntity('creditRequest', WITHIN_CEILING);
    const entry = audit.items.find((item) => item.action === 'creditRequest.approve');
    expect(entry).toBeDefined();
    expect(entry?.actorName).toBe('Ruwan Jayasuriya');
    // The ceiling is part of the record — it is what settles a dispute about a
    // limit that has since moved.
    expect(entry?.after).toMatchObject({
      status: 'approved',
      ceiling: request.eligibility.ceiling,
    });
  });

  it('subtracts what is already drawn from what is still available', async () => {
    /**
     * The other half of the same chain, observed on a supplier who already owes.
     *
     * It cannot be observed by re-reading the row just approved: a decided request
     * keeps the figures it was decided against, deliberately, so its `outstanding`
     * stays at whatever it was. `crd-7` is seeded against a supplier carrying a
     * manure balance precisely so the subtraction is visible with a real number
     * rather than against a column of zeroes.
     */
    await signInAs(CLERK);
    const request = await creditRepository.get('crd-7');

    expect(request.eligibility.outstanding).toBeGreaterThan(0);
    expect(request.eligibility.available).toBe(
      round2(request.eligibility.ceiling - request.eligibility.outstanding),
    );
    expect(request.eligibility.available).toBeLessThan(request.eligibility.ceiling);
  });
});

describe('M7 refusals', () => {
  it('refuses an approval against a ceiling that has moved (BR-310)', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get(WITHIN_CEILING);

    await expect(
      creditRepository.approve(
        WITHIN_CEILING,
        // A figure that was never on screen — the shape of a queue rendered before
        // this morning's leaf was recorded.
        { note: NOTE, ceilingSeen: round2(request.eligibility.ceiling + 1) },
        { amount: request.amount, available: request.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'stale-eligibility' });
  });

  it('refuses an approval after a weighing actually moves the ceiling', async () => {
    // The same refusal, reached the way it happens in the office rather than by
    // sending a wrong number: the clerk loads the queue, a weigher records leaf,
    // the clerk clicks approve.
    await signInWithMfaAs(MANAGER);
    const asRendered = await creditRepository.get(WITHIN_CEILING);

    await signInAs(WEIGHER);
    await deliveryRepository.commit({
      date: colomboDayOf(new Date()),
      collectionPoint: 'MAKADURA',
      batchId: 'test-credit-stale',
      rows: [{ supplierId: asRendered.supplierId, kgs: 55.5 }],
    });

    await signInWithMfaAs(MANAGER);
    await expect(
      creditRepository.approve(
        WITHIN_CEILING,
        { note: NOTE, ceilingSeen: asRendered.eligibility.ceiling },
        { amount: asRendered.amount, available: asRendered.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'stale-eligibility' });
  });

  it('lets a rejection through on figures that have moved', async () => {
    /**
     * Deliberately **not** symmetrical with the approval above.
     *
     * A rejection lends nothing, so gating it on fresh eligibility would trap the
     * row: the figures move again while the clerk reloads, and it can never be
     * cleared.
     */
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get('crd-5');

    const decided = await creditRepository.reject('crd-5', {
      note: 'Asked at the counter to wait until the account is paid.',
      ceilingSeen: round2(request.eligibility.ceiling + 1),
    });
    expect(decided.status).toBe('rejected');
  });

  it('refuses more than the supplier may draw, on the client and on the server', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get(OVER_CEILING);
    expect(request.amount).toBeGreaterThan(request.eligibility.available);

    // The repository guard, so the button is never the thing that fails.
    await expect(
      creditRepository.approve(
        OVER_CEILING,
        { note: NOTE, ceilingSeen: request.eligibility.ceiling },
        { amount: request.amount, available: request.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'over-ceiling' });

    // And the server, bypassing it — the console can be edited.
    const endpoints = await import('@/services/endpoints/credit');
    await expect(
      endpoints.creditEndpoints.approve(OVER_CEILING, {
        note: NOTE,
        ceilingSeen: request.eligibility.ceiling,
      }),
    ).rejects.toMatchObject({ code: 'over-ceiling' });
  });

  it('refuses self-approval (BR-501)', async () => {
    // The manager is the only role that may approve credit, so the four-eyes
    // fixture has to be one they raised themselves — see the seed's note.
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get(OFFICE_RAISED);
    expect(request.channel).toBe('office');
    expect(request.createdById).toBe('usr-manager-1');

    await expect(
      creditRepository.approve(
        OFFICE_RAISED,
        { note: 'Approving my own request, which must not be allowed.', ceilingSeen: request.eligibility.ceiling },
        { amount: request.amount, available: request.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'four-eyes-violation' });
  });

  it('checks four eyes before it checks the figures', async () => {
    // Order matters: who may decide does not depend on what the ceiling says, and
    // a stale-eligibility answer here would tell the wrong person to reload rather
    // than to hand it over.
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get(OFFICE_RAISED);

    await expect(
      creditRepository.approve(
        OFFICE_RAISED,
        { note: 'A note long enough to pass client validation.', ceilingSeen: 1 },
        { amount: request.amount, available: request.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'four-eyes-violation' });
  });

  it('refuses a decision with no note, on the client and on the server (AC-06)', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get('crd-3');

    await expect(
      creditRepository.approve(
        'crd-3',
        { note: 'ok', ceilingSeen: request.eligibility.ceiling },
        { amount: request.amount, available: request.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'note-required' });

    const endpoints = await import('@/services/endpoints/credit');
    await expect(
      endpoints.creditEndpoints.approve('crd-3', {
        note: 'no',
        ceilingSeen: request.eligibility.ceiling,
      }),
    ).rejects.toMatchObject({ code: 'note-required' });
  });

  it('refuses a second decision on a request that is already decided', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await creditRepository.get(ALREADY_APPROVED);
    expect(request.status).toBe('approved');

    await expect(
      creditRepository.approve(
        ALREADY_APPROVED,
        { note: 'Second decision, which must be refused rather than overwrite.', ceilingSeen: request.eligibility.ceiling },
        { amount: request.amount, available: request.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'already-decided' });
  });

  it('freezes the figures a decided request was decided against', async () => {
    await signInAs(CLERK);
    const first = await creditRepository.get(ALREADY_APPROVED);

    await signInAs(WEIGHER);
    await deliveryRepository.commit({
      date: colomboDayOf(new Date()),
      collectionPoint: 'MAKADURA',
      batchId: 'test-credit-frozen',
      rows: [{ supplierId: first.supplierId, kgs: 61 }],
    });

    await signInAs(CLERK);
    const second = await creditRepository.get(ALREADY_APPROVED);

    // Recomputing here would make every past approval look wrong the moment a
    // supplier's leaf changed.
    expect(second.eligibility.ceiling).toBe(first.eligibility.ceiling);
    expect(second.eligibility.computedAt).toBe(first.eligibility.computedAt);
  });
});

describe('M7 permissions (§12.1)', () => {
  it('gives the weigher no access to credit at all', async () => {
    await signInAs(WEIGHER);
    await expect(creditRepository.list()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('lets an accountant read the queue and refuses them the decision', async () => {
    // `creditRequests: R` for the accountant, `A` for the clerk and the manager.
    // Easy to get wrong, because the accountant outranks the clerk on every money
    // module — and credit is the one they only watch.
    await signInAs(ACCOUNTANT);
    await expect(creditRepository.list()).resolves.toBeTruthy();

    const request = await creditRepository.get('crd-8');
    await expect(
      creditRepository.approve(
        'crd-8',
        { note: NOTE, ceilingSeen: request.eligibility.ceiling },
        { amount: request.amount, available: request.eligibility.available },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('AC-07 · a facility the factory does not sell', () => {
  it('is absent from the queue and refused by the endpoint', async () => {
    await signInAs(CLERK);
    const token = useAuthStore.getState().accessToken;

    /**
     * Driven with `fetch` and an explicit `X-Tenant`, because the console resolves
     * its tenant once at module load and switching mid-session is deliberately
     * impossible. This is how a replayed request or a hand-typed URL arrives.
     */
    const asTenant = (tenant: string, path: string) =>
      fetch(`http://localhost${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant': tenant },
      });

    // Highland lends against leaf but not against income history or fertilizer.
    const listed = await asTenant('highland', '/admin/credit-requests?status=pending&pageSize=50');
    expect(listed.status).toBe(200);
    const page = (await listed.json()) as { items: Array<{ facility: string }> };
    expect(page.items.length).toBeGreaterThan(0);
    // Not "shown as zero" — absent. An empty queue and one that cannot exist look
    // identical on screen, and one of them wastes a clerk's attention.
    expect(page.items.every((row) => row.facility === 'advance')).toBe(true);

    // And a loan reached by its own URL is refused rather than merely unlisted.
    const refused = await asTenant('highland', `/admin/credit-requests/${OFFICE_RAISED}`);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'feature-disabled' });
  });
});

describe('M7 detail screen', () => {
  it('shows the working, not just the ceiling (AC-05)', async () => {
    await signInAs(CLERK);
    renderDetail(WITHIN_CEILING);

    expect(await screen.findByText('How this was worked out')).toBeInTheDocument();
    expect(screen.getByText('Rate per kg that priced it')).toBeInTheDocument();
    expect(screen.getByText('Closed months of income')).toBeInTheDocument();
    expect(screen.getByText('Still available')).toBeInTheDocument();
  });

  it('withholds Approve when the ask is over the ceiling, and says why', async () => {
    await signInWithMfaAs(MANAGER);
    renderDetail(OVER_CEILING);

    expect(await screen.findByText(/More than they may draw/i)).toBeInTheDocument();
    // Rejecting is still available — the row has to be clearable.
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it('explains the four-eyes rule instead of offering a form that will fail', async () => {
    await signInWithMfaAs(MANAGER);
    renderDetail(OFFICE_RAISED);

    expect(await screen.findByText(/money takes four eyes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it('keeps the approve button disabled until the note is long enough (AC-06)', async () => {
    const user = userEvent.setup();
    await signInWithMfaAs(MANAGER);
    renderDetail(WITHIN_CEILING);

    await user.click(await screen.findByRole('button', { name: /^approve$/i }));

    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: /^approve$/i });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox'), 'Within the ceiling for this month.');
    await waitFor(() => expect(submit).toBeEnabled());
  });
});

describe('M7 domain rules', () => {
  it('treats a supplier with no accounts as ineligible for every facility', () => {
    const at = '2026-08-01T00:00:00.000Z';
    for (const facility of ['advance', 'loan', 'manure'] as const) {
      const eligibility = buildCreditEligibility({
        facility,
        bills: [],
        outstanding: 0,
        computedAt: at,
      });
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.ceiling).toBe(0);
      expect(eligibility.reasonKey).not.toBeNull();
    }
  });
});
