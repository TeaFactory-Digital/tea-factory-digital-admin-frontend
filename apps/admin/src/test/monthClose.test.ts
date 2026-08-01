/**
 * M4 against the mock API.
 *
 * Publishing is the only irreversible act in the console, so this suite is mostly
 * about the things that must *not* happen. Each refusal below is a month the office
 * would otherwise have closed wrongly, and a wrongly-closed month is not a bug
 * report — it is bills, payouts and savings deductions built on the wrong figure:
 *
 *  - **`rate-missing`** — no auction rate, nothing to build a bill from.
 *  - **`exceptions-open`** (AC-04) — the accountant resolves each one, and the
 *    count cannot be clicked past.
 *  - **`four-eyes-violation`** (BR-501) — a manager holds `approve`, which implies
 *    `write`, so the same person *could* enter a rate and close the month on it.
 *  - **`already-published`** and **`month-locked`** — a published month is
 *    immutable (BR-108), for its rate, its exceptions and its leaf alike.
 *
 * The last one is the cross-module case and the reason M4 keeps the stage in state:
 * publishing a month has to stop M3 accepting leaf into it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { colomboDayOf } from '@tfd/domain';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const WEIGHER = 'weigher@galabodatea.lk';

const TODAY = colomboDayOf(new Date());

/** The month in progress — the only one the fixture leaves open. */
async function openMonth() {
  const page = await monthRepository.list();
  const open = page.items.find((m) => m.open);
  if (!open) throw new Error('fixture has no open month');
  return open;
}

/** Clear every open exception, which is what AC-04 asks the accountant to do. */
async function resolveAll(monthKey: string) {
  const open = await monthRepository.exceptions(monthKey, { resolved: false });
  await Promise.all(
    open.items.map((exception) =>
      monthRepository.resolveException(
        monthKey,
        exception.id,
        'Checked against the counter records and accepted for this month.',
      ),
    ),
  );
  return open.items.length;
}

describe('M4 rates & month close', () => {
  beforeEach(() => {
    signOut();
  });

  it('shows the month in progress with no rate, and the closed months with one', async () => {
    await signInAs(ACCOUNTANT);
    const page = await monthRepository.list();

    const open = page.items.filter((m) => m.open);
    expect(open).toHaveLength(1);
    // `awaitingRate` is the honest default: no auction result yet, which is why
    // every rate-derived figure in the app is blank rather than zero.
    expect(open[0]).toMatchObject({ stage: 'awaitingRate', ratePerKg: null, rate: null });

    const closed = page.items.filter((m) => !m.open);
    expect(closed.length).toBeGreaterThan(0);
    for (const month of closed) {
      expect(month.stage).toBe('published');
      expect(month.rate?.ratePerKg).toBeGreaterThan(0);
      expect(month.publishedByName).toBeTruthy();
    }
  });

  it('derives the month’s totals from the delivery rows, not a stored figure', async () => {
    await signInAs(ACCOUNTANT);
    const before = await openMonth();

    // Record leaf, then read the month again: the total has to move by exactly
    // what was weighed, because a bill is a read model over these rows (§16).
    signOut();
    await signInAs(WEIGHER);
    const supplier = (await supplierRepository.list({ status: 'active', pageSize: 1 })).items[0]!;
    await deliveryRepository.commit({
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId: 'm4-total-check',
      rows: [{ supplierId: supplier.id, kgs: 60 }],
    });

    signOut();
    await signInAs(ACCOUNTANT);
    const after = await monthRepository.get(before.monthKey);
    expect(after.totalKgs).toBeCloseTo(before.totalKgs + 60, 2);
    expect(after.deliveryCount).toBe(before.deliveryCount + 1);
  });

  it('records the rate, moves the stage on, and refuses a figure that is not money', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();

    await expect(monthRepository.setRate(month.monthKey, { ratePerKg: 0, extraRatePerKg: 0 }))
      .rejects.toMatchObject({ code: 'invalid-rate' });
    // Three decimals is not a rate the database can hold, and a silently rounded
    // rate is a bill that disagrees with the auction sheet.
    await expect(
      monthRepository.setRate(month.monthKey, { ratePerKg: 122.505, extraRatePerKg: 8 }),
    ).rejects.toMatchObject({ code: 'invalid-rate' });

    const saved = await monthRepository.setRate(month.monthKey, {
      ratePerKg: 122.5,
      extraRatePerKg: 8,
    });
    expect(saved.rate).toMatchObject({
      ratePerKg: 122.5,
      extraRatePerKg: 8,
      enteredByName: 'Dilani Fonseka',
    });
    // The stage is derived from what has happened, never set by the client.
    expect(saved.stage).toBe('rateEntered');

    // Re-entering before the publish is a correction, not a second rate.
    const corrected = await monthRepository.setRate(month.monthKey, {
      ratePerKg: 125,
      extraRatePerKg: 8,
    });
    expect(corrected.rate?.ratePerKg).toBe(125);
  });

  it('refuses to publish without a rate, and with exceptions still open', async () => {
    await signInWithMfaAs(MANAGER);
    const month = await openMonth();

    await expect(monthRepository.publish(month.monthKey)).rejects.toMatchObject({
      code: 'rate-missing',
    });

    // A rate, but the exceptions are untouched.
    await monthRepository.setRate(month.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    const withRate = await monthRepository.get(month.monthKey);
    expect(withRate.openExceptions).toBeGreaterThan(0);

    const refused = await monthRepository.publish(month.monthKey).catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('exceptions-open');
    expect(isApiError(refused) && refused.status).toBe(409);
  });

  it('refuses to resolve an exception without a note, or twice', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();
    const open = await monthRepository.exceptions(month.monthKey, { resolved: false });
    const target = open.items[0]!;

    await expect(
      monthRepository.resolveException(month.monthKey, target.id, 'too short'),
    ).rejects.toMatchObject({ code: 'note-required' });

    const note = 'Bank details collected at the counter and entered on the record.';
    const resolved = await monthRepository.resolveException(month.monthKey, target.id, note);
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolutionNote).toBe(note);
    expect(resolved.resolvedByName).toBe('Dilani Fonseka');

    await expect(
      monthRepository.resolveException(month.monthKey, target.id, note),
    ).rejects.toMatchObject({ code: 'already-resolved' });

    // The count the checklist reads moves with it.
    const after = await monthRepository.get(month.monthKey);
    expect(after.openExceptions).toBe(month.openExceptions - 1);
  });

  it('refuses the publisher who entered the rate (BR-501)', async () => {
    // A manager holds `approve`, which implies `write` — so they *can* enter a
    // rate, and this is the check that stops them closing the month on it.
    await signInWithMfaAs(MANAGER);
    const month = await openMonth();
    await monthRepository.setRate(month.monthKey, { ratePerKg: 130, extraRatePerKg: 5 });
    await resolveAll(month.monthKey);

    await expect(monthRepository.publish(month.monthKey)).rejects.toMatchObject({
      code: 'four-eyes-violation',
    });
  }, 20_000);

  it('publishes when every step passes, and then locks the month everywhere', async () => {
    // The accountant enters the rate and clears the exceptions…
    await signInAs(ACCOUNTANT);
    const month = await openMonth();
    await monthRepository.setRate(month.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    const cleared = await resolveAll(month.monthKey);
    expect(cleared).toBeGreaterThan(0);

    // …and the accountant may not publish: §12.1 gives them `write`, not `approve`.
    const refused = await monthRepository.publish(month.monthKey).catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');

    // The manager publishes.
    signOut();
    await signInWithMfaAs(MANAGER);
    const published = await monthRepository.publish(month.monthKey, 'Closed after the June audit.');
    expect(published.stage).toBe('published');
    expect(published.open).toBe(false);
    expect(published.publishedByName).toBe('Ruwan Jayasuriya');

    // Twice is refused rather than silently re-closing it.
    await expect(monthRepository.publish(month.monthKey)).rejects.toMatchObject({
      code: 'already-published',
    });
    // And the rate is now part of the record.
    signOut();
    await signInAs(ACCOUNTANT);
    await expect(
      monthRepository.setRate(month.monthKey, { ratePerKg: 999, extraRatePerKg: 0 }),
    ).rejects.toMatchObject({ code: 'month-locked' });

    /**
     * The cross-module consequence, and the reason the stage is state: M3 must stop
     * accepting leaf into a month M4 has closed (BR-108).
     */
    signOut();
    await signInAs(WEIGHER);
    const day = await deliveryRepository.day(TODAY, 'MAKADURA');
    expect(day.locked).toBe(true);
    expect(day.monthStage).toBe('published');

    const supplier = (await supplierRepository.list({ status: 'active', pageSize: 1 })).items[0]!;
    await expect(
      deliveryRepository.commit({
        date: TODAY,
        collectionPoint: 'MAKADURA',
        batchId: 'm4-after-publish',
        rows: [{ supplierId: supplier.id, kgs: 10 }],
      }),
    ).rejects.toMatchObject({ code: 'month-locked' });
  }, 20_000);

  it('writes the audit trail for the rate, the resolutions and the publish (AC-09)', async () => {
    await signInAs(ACCOUNTANT);
    const month = await openMonth();
    await monthRepository.setRate(month.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    await resolveAll(month.monthKey);

    signOut();
    await signInWithMfaAs(MANAGER);
    await monthRepository.publish(month.monthKey);

    const trail = await auditRepository.list({ pageSize: 200 });
    const actions = trail.items.map((entry) => entry.action);
    expect(actions).toContain('month.rate.enter');
    expect(actions).toContain('month.exception.resolve');
    expect(actions).toContain('month.publish');

    const publish = trail.items.find((entry) => entry.action === 'month.publish');
    expect(publish).toMatchObject({ actorName: 'Ruwan Jayasuriya', entityId: month.monthKey });
    // The rate the month closed on is in the entry, because "what was it published
    // at" is the question asked six months later.
    expect(publish?.after).toMatchObject({ ratePerKg: 122.5, extraRatePerKg: 8 });
  }, 20_000);

  it('answers 404 for a month the factory has no records for', async () => {
    await signInAs(ACCOUNTANT);
    // A stale bookmark, a typo, or a key from another screen. An empty-looking
    // "published" month invented on the spot would be worse than a refusal.
    await expect(monthRepository.get('1999-01')).rejects.toMatchObject({ code: '404' });
    await expect(
      monthRepository.setRate('1999-01', { ratePerKg: 100, extraRatePerKg: 0 }),
    ).rejects.toMatchObject({ code: '404' });

    // Publishing needs `approve`, and the capability check runs *before* the
    // lookup — so the accountant gets `forbidden` here, not `404`. The manager is
    // the one who reaches the missing month.
    signOut();
    await signInWithMfaAs(MANAGER);
    await expect(monthRepository.publish('1999-01')).rejects.toMatchObject({ code: '404' });
  });

  it('gives a clerk no access to the month close at all (§12.1)', async () => {
    await signInAs(CLERK);
    const refused = await monthRepository.list().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  });
});
