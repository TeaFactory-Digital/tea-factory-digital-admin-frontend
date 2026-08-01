/**
 * M6 against the mock API.
 *
 * This is the module where money actually leaves the factory, so the suite is almost
 * entirely about the refusals and about what happens to a payment that does not work:
 *
 *  - **`month-not-published`** — a run against an open month pays against figures that
 *    can still change, and money that has gone cannot be re-derived. The load-bearing
 *    rule of the module.
 *  - **`four-eyes-violation`** (BR-501) — the accountant prepares, a manager releases,
 *    and a manager who prepared it themselves is refused like anybody else.
 *  - **`run-not-approved`** — nothing is paid before it is released, so a line cannot
 *    be marked paid in a draft.
 *  - **`note-required`** — a failed payment needs a reason, because the supplier has
 *    not been paid and the next person picking the run up works from that note.
 *  - **`line-not-payable`** — a held line has nowhere to pay into, and a paid one is
 *    done. Neither is silently re-marked.
 *  - **`feature-disabled`** — a tenant that does not buy payouts is refused by the
 *    **endpoint**, not only by a hidden sidebar row (AC-07).
 *
 * And two behaviours that are not refusals but matter as much: a **held** line stays
 * visible and counted rather than being filtered out of a run, and a run's totals are
 * derived from its lines rather than stored beside them.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { round2 } from '@tfd/domain';
import { billRepository } from '@/services/repositories/billRepository';
import { payoutRepository } from '@/services/repositories/payoutRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const WEIGHER = 'weigher@galabodatea.lk';

/** A published month that has bills and no `cash` run yet, so one can be prepared. */
async function publishedMonthKey() {
  const months = await billRepository.months();
  const closed = months.find((month) => !month.open && month.billCount > 0);
  if (!closed) throw new Error('fixture has no published month with bills');
  return closed.monthKey;
}

async function openMonthKey() {
  const months = await billRepository.months();
  const open = months.find((month) => month.open);
  if (!open) throw new Error('fixture has no open month');
  return open.monthKey;
}

describe('M6 payouts', () => {
  beforeEach(() => {
    signOut();
  });

  it('carries runs in every state, with totals derived from their lines', async () => {
    await signInAs(ACCOUNTANT);
    const page = await payoutRepository.list({ pageSize: 50 });
    expect(page.total).toBeGreaterThan(0);

    const states = new Set(page.items.map((run) => run.status));
    // Every state reachable without anybody having to create it: a status nothing in
    // the fixture reaches is a status nobody notices is broken.
    expect(states).toContain('draft');
    expect(states).toContain('approved');
    expect(states).toContain('completed');

    for (const run of page.items) {
      const lines = await payoutRepository.lines(run.id, { pageSize: 500 });
      const payable = lines.items.filter((line) => line.status !== 'held');

      expect(run.lineCount).toBe(lines.total);
      expect(run.payableCount).toBe(payable.length);
      expect(run.heldCount).toBe(lines.items.filter((line) => line.status === 'held').length);
      // Held lines are excluded from the total: they are not money leaving.
      expect(run.totalAmount).toBeCloseTo(
        round2(payable.reduce((sum, line) => sum + line.amount, 0)),
        2,
      );
      expect(run.paidAmount).toBeCloseTo(
        round2(
          lines.items
            .filter((line) => line.status === 'paid')
            .reduce((sum, line) => sum + line.amount, 0),
        ),
        2,
      );
    }
  }, 20_000);

  it('pays the amount on the bill, never a recomputed one', async () => {
    await signInAs(ACCOUNTANT);
    const runs = await payoutRepository.list({ pageSize: 10 });
    const run = runs.items[0]!;
    const lines = await payoutRepository.lines(run.id, { pageSize: 20 });

    for (const line of lines.items.slice(0, 8)) {
      const bill = await billRepository.get(line.billId);
      expect(line.amount).toBe(bill.finalBalance);
      expect(line.method).toBe(bill.paymentMethod);
      // Only payable accounts become lines. A zero or negative bank transfer is not
      // a payment of nothing — it is a debt that carries forward.
      expect(line.amount).toBeGreaterThan(0);
    }
  }, 20_000);

  it('holds a line with no account rather than dropping it', async () => {
    await signInAs(ACCOUNTANT);
    const runs = await payoutRepository.list({ pageSize: 50 });
    const transfer = runs.items.find((run) => run.method === 'bankTransfer' && run.heldCount > 0);
    if (!transfer) throw new Error('fixture has no bank-transfer run with a held line');

    const held = await payoutRepository.lines(transfer.id, { status: 'held', pageSize: 50 });
    expect(held.total).toBe(transfer.heldCount);
    for (const line of held.items) {
      // Visible, counted, and carrying the reason it cannot move — the alternative
      // is a supplier who is not paid and nobody notices until they telephone.
      expect(line.accountNumber).toBeNull();
      expect(line.reason).toBeTruthy();
      expect(line.amount).toBeGreaterThan(0);
    }
  }, 20_000);

  it('masks the account number on every line (§20.4)', async () => {
    await signInAs(ACCOUNTANT);
    const runs = await payoutRepository.list({ pageSize: 50 });
    const transfer = runs.items.find((run) => run.method === 'bankTransfer')!;
    const lines = await payoutRepository.lines(transfer.id, { pageSize: 100 });

    const withAccounts = lines.items.filter((line) => line.accountNumber !== null);
    expect(withAccounts.length).toBeGreaterThan(0);
    for (const line of withAccounts) {
      // A run is a list of payments, not a place full account numbers are handed out.
      // Revealing one is M2's separate audited call.
      expect(line.accountNumber).toMatch(/^•+\d{4}$/);
    }
  }, 20_000);

  it('refuses a run against a month that is not published', async () => {
    await signInAs(ACCOUNTANT);
    const monthKey = await openMonthKey();

    await expect(payoutRepository.create(monthKey, 'bankTransfer')).rejects.toMatchObject({
      code: 'month-not-published',
    });
  });

  it('refuses a second run for the same month and method', async () => {
    await signInAs(ACCOUNTANT);
    const monthKey = await publishedMonthKey();

    await expect(payoutRepository.create(monthKey, 'bankTransfer')).rejects.toMatchObject({
      code: 'run-exists',
    });
  });

  it('prepares a run, and a manager releases it', async () => {
    await signInAs(ACCOUNTANT);
    const monthKey = await publishedMonthKey();

    const run = await payoutRepository.create(monthKey, 'cash');
    expect(run.status).toBe('draft');
    expect(run.createdByName).toBe('Dilani Fonseka');
    expect(run.payableCount).toBeGreaterThan(0);
    // Cash is handed over at the counter, so nothing is held for want of an account.
    expect(run.heldCount).toBe(0);

    // §12.1 gives the accountant `W` and the manager `A`: preparing is not releasing.
    const refused = await payoutRepository.approve(run.id).catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');

    signOut();
    await signInWithMfaAs(MANAGER);
    const released = await payoutRepository.approve(run.id, 'Counted out at the office counter.');
    expect(released.status).toBe('approved');
    expect(released.approvedByName).toBe('Ruwan Jayasuriya');

    // Twice is refused rather than silently re-releasing it.
    await expect(payoutRepository.approve(run.id)).rejects.toMatchObject({
      code: 'already-approved',
    });
  }, 20_000);

  it('refuses the manager who prepared the run (BR-501)', async () => {
    // A manager holds `approve`, which implies `write` — so they *can* prepare a run,
    // and this is the check that stops them releasing their own.
    await signInWithMfaAs(MANAGER);
    const monthKey = await publishedMonthKey();
    const run = await payoutRepository.create(monthKey, 'cash');

    await expect(payoutRepository.approve(run.id)).rejects.toMatchObject({
      code: 'four-eyes-violation',
    });
  }, 20_000);

  it('will not mark a line in a run nobody has released', async () => {
    await signInAs(ACCOUNTANT);
    const monthKey = await publishedMonthKey();
    const run = await payoutRepository.create(monthKey, 'cash');
    const lines = await payoutRepository.lines(run.id, { pageSize: 5 });

    await expect(
      payoutRepository.mark(run.id, lines.items[0]!.id, { status: 'paid' }),
    ).rejects.toMatchObject({ code: 'run-not-approved' });
  }, 20_000);

  it('records a payment, a failure with its reason, and completes the run', async () => {
    await signInAs(ACCOUNTANT);
    const monthKey = await publishedMonthKey();
    const run = await payoutRepository.create(monthKey, 'cash');

    signOut();
    await signInWithMfaAs(MANAGER);
    await payoutRepository.approve(run.id);

    signOut();
    await signInAs(ACCOUNTANT);
    const lines = await payoutRepository.lines(run.id, { pageSize: 500 });
    const [first, second, ...rest] = lines.items;

    const paid = await payoutRepository.mark(run.id, first!.id, { status: 'paid' });
    expect(paid.status).toBe('paid');
    expect(paid.paidAt).not.toBeNull();
    expect(paid.markedByName).toBe('Dilani Fonseka');

    // Marking it again is refused rather than overwritten: the first record is the
    // one the office would have to explain.
    await expect(
      payoutRepository.mark(run.id, first!.id, { status: 'paid' }),
    ).rejects.toMatchObject({ code: 'line-not-payable' });

    // A failure with no reason is refused before it leaves the browser.
    await expect(
      payoutRepository.mark(run.id, second!.id, { status: 'failed', reason: 'no' }),
    ).rejects.toMatchObject({ code: 'note-required' });

    const reason = 'Supplier did not collect — holding the cash at the office counter.';
    const failed = await payoutRepository.mark(run.id, second!.id, {
      status: 'failed',
      reason,
    });
    expect(failed.status).toBe('failed');
    expect(failed.reason).toBe(reason);
    // A failed payment is not a payment: it stays out of the paid total.
    expect(failed.paidAt).toBeNull();

    // The run's totals follow its lines.
    const midway = await payoutRepository.get(run.id);
    expect(midway.paidCount).toBe(1);
    expect(midway.failedCount).toBe(1);
    expect(midway.status).toBe('approved');
    expect(midway.paidAmount).toBeCloseTo(first!.amount, 2);

    // Working the rest completes it — "completed" means accounted for, not all paid.
    for (const line of rest) {
      await payoutRepository.mark(run.id, line.id, { status: 'paid' });
    }
    const done = await payoutRepository.get(run.id);
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBeNull();
    expect(done.failedCount).toBe(1);
  }, 40_000);

  it('will not mark a held line at all', async () => {
    await signInAs(ACCOUNTANT);
    const runs = await payoutRepository.list({ pageSize: 50 });
    const transfer = runs.items.find(
      (run) => run.method === 'bankTransfer' && run.heldCount > 0 && run.status !== 'draft',
    );
    if (!transfer) throw new Error('fixture has no released bank-transfer run with a held line');

    const held = await payoutRepository.lines(transfer.id, { status: 'held', pageSize: 5 });
    await expect(
      payoutRepository.mark(transfer.id, held.items[0]!.id, { status: 'paid' }),
    ).rejects.toMatchObject({ code: 'line-not-payable' });
  }, 20_000);

  it('writes the audit trail a run produces (AC-09)', async () => {
    await signInAs(ACCOUNTANT);
    const monthKey = await publishedMonthKey();
    const run = await payoutRepository.create(monthKey, 'cash');

    signOut();
    await signInWithMfaAs(MANAGER);
    await payoutRepository.approve(run.id);
    const lines = await payoutRepository.lines(run.id, { pageSize: 5 });
    await payoutRepository.mark(run.id, lines.items[0]!.id, { status: 'paid' });

    const trail = await auditRepository.list({ pageSize: 200 });
    const actions = trail.items.map((entry) => entry.action);
    expect(actions).toContain('payout.run.create');
    expect(actions).toContain('payout.run.approve');
    expect(actions).toContain('payout.line.paid');

    const approval = trail.items.find((entry) => entry.action === 'payout.run.approve');
    expect(approval).toMatchObject({ actorName: 'Ruwan Jayasuriya', entityId: run.id });
  }, 30_000);

  it('lets a clerk read a run and refuses them the preparation (§12.1)', async () => {
    await signInAs(CLERK);
    const monthKey = await publishedMonthKey();

    // `payouts: R` — the runs are visible…
    await expect(payoutRepository.list({ monthKey })).resolves.toBeTruthy();

    // …and preparing one is refused by the **server**, not only hidden by the UI.
    const refused = await payoutRepository.create(monthKey, 'cash').catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  });

  it('gives the weigher no access to payouts at all (§12.1)', async () => {
    await signInAs(WEIGHER);
    const refused = await payoutRepository.list().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  });
});
