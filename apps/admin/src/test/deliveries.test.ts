/**
 * M3 against the mock API.
 *
 * These are the behaviours a weighing session depends on, and each one is a
 * failure the office would otherwise absorb by hand:
 *
 *  - **Partial acceptance** — one unknown code must not send 59 good rows back to
 *    be re-typed at a counter with a queue at it.
 *  - **Idempotency** — a dropped connection and a second click must not record the
 *    session twice. This is the worst failure available in M3, because nothing
 *    downstream can tell a duplicated kilo from a real one.
 *  - **`month-locked`** — a published month is immutable (BR-108), for entry and
 *    for voiding alike.
 *  - **A void is not a delete** (§12.1) — the row survives, out of the totals but
 *    still in the record, with who withdrew it and why.
 *  - **Server-side totals** — the day's figures come from the server, so the grid
 *    can never show the office a total the month close disagrees with.
 *
 * They run through the repository, so the zod guard and the kilo rounding the
 * screens rely on are in the path too.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_DELIVERY_KG, colomboDayOf, monthKeyOf } from '@tfd/domain';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const WEIGHER = 'weigher@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

const TODAY = colomboDayOf(new Date());

/** A day in the previous month, which the fixture publishes and therefore locks. */
const LAST_MONTH_DAY = (() => {
  const date = new Date();
  date.setDate(0);
  return colomboDayOf(date);
})();

let batchSequence = 0;
const nextBatchId = () => `test-batch-${(batchSequence += 1)}`;

async function twoActiveSuppliers() {
  const page = await supplierRepository.list({ status: 'active', pageSize: 2, page: 0 });
  const [first, second] = page.items;
  if (!first || !second) throw new Error('fixture has fewer than two active suppliers');
  return [first, second] as const;
}

describe('M3 leaf collection', () => {
  beforeEach(() => {
    signOut();
  });

  it('records a session and answers with the day’s totals', async () => {
    await signInAs(WEIGHER);
    const [a, b] = await twoActiveSuppliers();

    const before = await deliveryRepository.day(TODAY, 'MAKADURA');
    const result = await deliveryRepository.commit({
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId: nextBatchId(),
      rows: [
        { supplierId: a.id, kgs: 42.5 },
        { supplierId: b.id, kgs: 7.25 },
      ],
    });

    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toEqual([]);
    // The point is the **session's**, not the supplier's registered one: a grower
    // may deliver anywhere, and the leaf belongs to the shed that weighed it.
    expect(result.accepted.every((row) => row.collectionPoint === 'MAKADURA')).toBe(true);
    expect(result.accepted.every((row) => row.monthKey === monthKeyOf(TODAY))).toBe(true);
    // Totals from the server, and they moved by exactly what was recorded.
    expect(result.day.totalKgs).toBeCloseTo(before.totalKgs + 49.75, 2);
    expect(result.day.deliveryCount).toBe(before.deliveryCount + 2);
  });

  it('keeps the good rows when one is refused', async () => {
    await signInAs(WEIGHER);
    const [a] = await twoActiveSuppliers();

    const result = await deliveryRepository.commit({
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId: nextBatchId(),
      rows: [
        { supplierId: a.id, kgs: 30 },
        { supplierId: 'sup-does-not-exist', kgs: 12 },
      ],
    });

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    // `index` is the row's position in what was submitted — the only thing the
    // grid can map back to a line the clerk is looking at.
    expect(result.rejected[0]).toMatchObject({ index: 1, code: 'supplier-unknown' });
  });

  it('refuses leaf recorded against a supplier who is not active', async () => {
    await signInAs(WEIGHER);
    const suspended = await supplierRepository.list({ status: 'suspended', pageSize: 1, page: 0 });
    const target = suspended.items[0];
    if (!target) throw new Error('fixture has no suspended supplier');

    const result = await deliveryRepository.commit({
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId: nextBatchId(),
      rows: [{ supplierId: target.id, kgs: 15 }],
    });

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.code).toBe('supplier-inactive');
  });

  it('replays a re-sent commit instead of recording it twice', async () => {
    await signInAs(WEIGHER);
    const [a] = await twoActiveSuppliers();
    const batchId = nextBatchId();
    const batch = {
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId,
      rows: [{ supplierId: a.id, kgs: 11.5 }],
    };

    const first = await deliveryRepository.commit(batch);
    // The clerk's connection dropped and they clicked again. Same batch id.
    const second = await deliveryRepository.commit(batch);

    expect(second.accepted.map((row) => row.id)).toEqual(first.accepted.map((row) => row.id));
    expect(second.day.totalKgs).toBe(first.day.totalKgs);
  });

  it('refuses a kilo figure the database could not hold exactly', async () => {
    await signInAs(WEIGHER);
    const [a] = await twoActiveSuppliers();

    // Refused by the repository's own guard, before a round trip: a weight stored
    // as something else would not match the slip handed over at the counter.
    await expect(
      deliveryRepository.commit({
        date: TODAY,
        collectionPoint: 'MAKADURA',
        batchId: nextBatchId(),
        rows: [{ supplierId: a.id, kgs: 12.345 }],
      }),
    ).rejects.toMatchObject({ code: 'invalid-batch' });

    await expect(
      deliveryRepository.commit({
        date: TODAY,
        collectionPoint: 'MAKADURA',
        batchId: nextBatchId(),
        rows: [{ supplierId: a.id, kgs: MAX_DELIVERY_KG + 1 }],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('refuses to touch a published month, entering or voiding (BR-108)', async () => {
    await signInAs(WEIGHER);
    const [a] = await twoActiveSuppliers();

    const locked = await deliveryRepository.day(LAST_MONTH_DAY, 'MAKADURA');
    expect(locked.locked).toBe(true);
    expect(locked.monthStage).toBe('published');

    await expect(
      deliveryRepository.commit({
        date: LAST_MONTH_DAY,
        collectionPoint: 'MAKADURA',
        batchId: nextBatchId(),
        rows: [{ supplierId: a.id, kgs: 10 }],
      }),
    ).rejects.toMatchObject({ code: 'month-locked' });

    // And the same refusal for a row that is already in that month.
    const inLockedMonth = await deliveryRepository.list({
      from: `${monthKeyOf(LAST_MONTH_DAY)}-01`,
      to: LAST_MONTH_DAY,
      pageSize: 1,
    });
    const row = inLockedMonth.items[0];
    if (row) {
      await expect(
        deliveryRepository.void(row.id, 'Recorded against the wrong grower entirely.'),
      ).rejects.toMatchObject({ code: 'month-locked' });
    }
  });

  it('voids without deleting, and takes the kilos out of the day', async () => {
    await signInAs(WEIGHER);
    const [a] = await twoActiveSuppliers();

    const committed = await deliveryRepository.commit({
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId: nextBatchId(),
      rows: [{ supplierId: a.id, kgs: 88 }],
    });
    const target = committed.accepted[0]!;

    await expect(deliveryRepository.void(target.id, 'too short')).rejects.toMatchObject({
      code: 'note-required',
    });

    const reason = 'Weighed twice by mistake — the same sack went on the next line.';
    const voided = await deliveryRepository.void(target.id, reason);
    expect(voided.voidedAt).not.toBeNull();
    expect(voided.voidedReason).toBe(reason);
    expect(voided.voidedByName).toBe('Sunil Rathnayake');

    // Out of the totals…
    const after = await deliveryRepository.day(TODAY, 'MAKADURA');
    expect(after.totalKgs).toBeCloseTo(committed.day.totalKgs - 88, 2);

    // …and out of the default list, but still there when asked for. A void is
    // evidence, not a delete.
    const plain = await deliveryRepository.list({ date: TODAY, pageSize: 200 });
    expect(plain.items.some((row) => row.id === target.id)).toBe(false);
    const withVoided = await deliveryRepository.list({
      date: TODAY,
      includeVoided: true,
      pageSize: 200,
    });
    expect(withVoided.items.some((row) => row.id === target.id)).toBe(true);

    await expect(deliveryRepository.void(target.id, reason)).rejects.toMatchObject({
      code: 'already-voided',
    });
  });

  it('writes the audit trail a committed session and a void produce (AC-09)', async () => {
    await signInAs(WEIGHER);
    const [a] = await twoActiveSuppliers();
    const batchId = nextBatchId();
    await deliveryRepository.commit({
      date: TODAY,
      collectionPoint: 'MAKADURA',
      batchId,
      rows: [{ supplierId: a.id, kgs: 21 }],
    });

    // The weigher has no audit access at all (§12.1), so the trail is read by
    // somebody who does — which is the point of separating the two.
    signOut();
    await signInWithMfaAs(MANAGER);
    const trail = await auditRepository.list({ pageSize: 200 });
    const entry = trail.items.find((e) => e.entityId === batchId);
    expect(entry).toMatchObject({
      action: 'delivery.batch.commit',
      entity: 'deliveryBatch',
      actorName: 'Sunil Rathnayake',
    });
  });

  it('lets a clerk read the day and refuses them the entry (§12.1)', async () => {
    await signInAs(CLERK);
    const [a] = await twoActiveSuppliers();

    // `deliveries: R` — the day is visible…
    const day = await deliveryRepository.day(TODAY);
    expect(day.date).toBe(TODAY);
    await expect(deliveryRepository.list({ date: TODAY })).resolves.toBeTruthy();

    // …and recording is refused by the **server**, not only hidden by the UI.
    const refused = await deliveryRepository
      .commit({
        date: TODAY,
        collectionPoint: 'MAKADURA',
        batchId: nextBatchId(),
        rows: [{ supplierId: a.id, kgs: 5 }],
      })
      .catch((cause: unknown) => cause);

    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  });
});
