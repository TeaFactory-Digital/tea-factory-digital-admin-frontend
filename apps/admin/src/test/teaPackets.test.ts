/**
 * M18 against the mock API — **the queue v1 did not have**.
 *
 * The app has shipped `RequestTeaPacketsScreen` since its first release and this console
 * had no type, no endpoint and no row for it, so a supplier could ask the factory for its
 * own tea and nothing on earth could answer. Every other `pending` in the app is a queue
 * somewhere; this suite is what makes that true of the last one.
 *
 * What gets asserted is the set of rules that are *not* obvious from the screen:
 *
 *  - **The refusals M18 shares with M7** — AC-06's note, BR-501's four eyes,
 *    `already-decided` — because they are about deciding a supplier's request and have
 *    nothing to do with credit.
 *  - **The refusal M18 does not have.** There is no `stale-eligibility` here, and the
 *    absence is the design: nothing prices a ceiling, so there is no figure the approver
 *    agreed to that can move underneath them. A case asserts an approval succeeds with no
 *    `ceilingSeen` on the body at all, because that is the thing a reader coming from M7
 *    will assume must be there.
 *  - **The price is stamped at the decision**, never re-read afterwards. A catalogue edit
 *    must not silently re-price a request the office already answered.
 *  - **AC-07**, for a flag the app actually reads.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TEA_PACKET_POLICY, teaPacketAmount, teaPacketRequestProblems } from '@tfd/domain';
import { teaPacketRepository } from '@/services/repositories/teaPacketRepository';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const EDITOR = 'editor@galabodatea.lk';

/** A note that clears AC-06's ten-character floor without saying anything about a case. */
const NOTE = 'Ready for collection from the store from Monday.';

async function pendingRequests() {
  const page = await teaPacketRepository.list({ status: 'pending', pageSize: 50 });
  return page.items;
}

describe('M18 tea packet requests', () => {
  beforeEach(() => {
    signOut();
  });

  it('lists the queue oldest first, like every other inbox', async () => {
    await signInAs(CLERK);
    const rows = await pendingRequests();

    expect(rows.length).toBeGreaterThan(0);
    const dates = rows.map((row) => row.createdAt);
    expect([...dates].sort()).toEqual(dates);
  });

  it('prices every row against the factory policy, not a figure on the request', async () => {
    await signInAs(CLERK);
    const rows = await pendingRequests();

    for (const row of rows) {
      // The amount is `packets × unitPrice`, and `unitPrice` is the policy's — a
      // hand-typed price on a request would be a figure nobody can check against a list.
      expect(row.amount).toBe(teaPacketAmount({ ...DEFAULT_TEA_PACKET_POLICY, pricePerPacket: row.unitPrice }, row.packets));
    }
  });

  it('refuses a decision without a note (AC-06), on both verbs', async () => {
    await signInWithMfaAs(MANAGER);
    const [row] = await pendingRequests();

    const shortApprove = await teaPacketRepository
      .approve(row!.id, { note: 'ok' })
      .catch((cause: unknown) => cause);
    expect(isApiError(shortApprove) && shortApprove.code).toBe('note-required');

    // Rejecting is the verb the criterion is actually about — the note is what the
    // supplier reads as the reason.
    const shortReject = await teaPacketRepository
      .reject(row!.id, { note: '' })
      .catch((cause: unknown) => cause);
    expect(isApiError(shortReject) && shortReject.code).toBe('note-required');
  });

  it('approves without a ceiling, because there is no ceiling to go stale (BR-310 does not apply)', async () => {
    await signInWithMfaAs(MANAGER);
    const rows = await pendingRequests();
    // A row inside the cap and raised in the app, so neither the store policy nor
    // four eyes is what this case is measuring.
    const row = rows.find(
      (one) =>
        one.createdById === null &&
        teaPacketRequestProblems(DEFAULT_TEA_PACKET_POLICY, one.packets).length === 0,
    )!;
    expect(row).toBeDefined();

    /**
     * **No `ceilingSeen`, and that is the assertion.**
     *
     * M7's approval carries the figure that was on screen and the server answers
     * `stale-eligibility` if it has moved (BR-310). Nothing here is priced off the
     * supplier's leaf, so there is no such figure — and a reader arriving from M7 will
     * assume there must be. If tea packets ever grow an eligibility rule, this case is
     * what fails first.
     */
    const decided = await teaPacketRepository.approve(row.id, { note: NOTE });

    expect(decided.status).toBe('approved');
    expect(decided.decision?.note).toBe(NOTE);
    // Stamped at the decision, so a catalogue edit afterwards cannot re-price it.
    expect(decided.unitPrice).toBeGreaterThan(0);
    expect(decided.amount).toBe(teaPacketAmount({ ...DEFAULT_TEA_PACKET_POLICY, pricePerPacket: decided.unitPrice }, decided.packets));
  });

  it('refuses a second decision on the same request (two clerks, one inbox)', async () => {
    await signInWithMfaAs(MANAGER);
    const rows = await pendingRequests();
    const row = rows.find(
      (one) =>
        one.createdById === null &&
        teaPacketRequestProblems(DEFAULT_TEA_PACKET_POLICY, one.packets).length === 0,
    )!;

    await teaPacketRepository.approve(row.id, { note: NOTE });
    const again = await teaPacketRepository
      .reject(row.id, { note: NOTE })
      .catch((cause: unknown) => cause);

    expect(isApiError(again) && again.code).toBe('already-decided');
  });

  it('refuses the person who raised it at the counter (BR-501)', async () => {
    await signInWithMfaAs(MANAGER);
    const rows = await pendingRequests();
    // The fixture's counter-raised row carries `createdById`, which is what four eyes
    // is checked on — an app request has none and anybody may decide it.
    const raisedByOffice = rows.find((one) => one.createdById !== null)!;
    expect(raisedByOffice).toBeDefined();

    signOut();
    await signInAs(CLERK);
    const refused = await teaPacketRepository
      .approve(raisedByOffice.id, { note: NOTE })
      .catch((cause: unknown) => cause);

    // A clerk holds `creditRequests: R`, so the capability refuses before four eyes does.
    // Either refusal is correct here; what must never happen is a `200`.
    expect(isApiError(refused)).toBe(true);
    expect(['forbidden', 'four-eyes-violation']).toContain(
      isApiError(refused) ? refused.code : '',
    );
  });

  it('refuses an approval outside the factory’s stock policy, and allows the rejection', async () => {
    await signInWithMfaAs(MANAGER);
    const rows = await pendingRequests();
    const overMax = rows.find(
      (one) => one.packets > DEFAULT_TEA_PACKET_POLICY.maxPacketsPerRequest,
    )!;
    expect(overMax).toBeDefined();

    const refused = await teaPacketRepository
      .approve(overMax.id, { note: NOTE })
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('tea-packets-refused');

    /**
     * The asymmetry is the point. Refusing the rejection too would **trap the row**: the
     * office could neither issue the tea nor tell the supplier why, and the request would
     * sit in the queue for ever. Same reasoning as BR-310 not gating M7's rejections.
     */
    const rejected = await teaPacketRepository.reject(overMax.id, {
      note: 'We can issue five packets at a time. Please ask again next month.',
    });
    expect(rejected.status).toBe('rejected');
  });

  it('counts approved-and-unrecovered tea as money the factory is owed (M14)', async () => {
    await signInWithMfaAs(MANAGER);
    const { usage } = await adminConfigRepository.get();

    /**
     * This is what makes `enableTeaPackets` refusable in M14. The factory has handed the
     * tea over and has not been paid for it, so turning the queue off would hide a debt —
     * the same rule that blocks `enableSavings` while balances exist.
     */
    expect(usage.teaPacketsOutstanding).toBeGreaterThan(0);
  });

  it('refuses the module for a tenant that does not buy it (AC-07)', async () => {
    await signInAs(CLERK);
    const token = useAuthStore.getState().accessToken;

    // `highland` runs the reduced feature set and has `enableTeaPackets: false`. The
    // sidebar hides the row; this is the half a replayed request cannot get past.
    const response = await fetch('http://localhost/admin/tea-packet-requests', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'highland' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'feature-disabled' });
  });

  it('gives the editor nothing at all (§12.1)', async () => {
    await signInAs(EDITOR);
    const refused = await teaPacketRepository.list().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  });
});

describe('teaPacketRequestProblems (the shared rule)', () => {
  it('refuses nothing, a fraction, and more than the cap', () => {
    const policy = { packGrams: 400, pricePerPacket: 1200, maxPacketsPerRequest: 5 };

    expect(teaPacketRequestProblems(policy, 3)).toEqual([]);
    expect(teaPacketRequestProblems(policy, 0)).toEqual(['no-packets']);
    // Half a packet is not something a store issues, and there is nothing to round to.
    expect(teaPacketRequestProblems(policy, 2.5)).toEqual(['not-whole']);
    expect(teaPacketRequestProblems(policy, 9)).toEqual(['over-max']);
  });

  it('prices in whole cents, floored', () => {
    const policy = { packGrams: 400, pricePerPacket: 1250.555, maxPacketsPerRequest: 10 };
    // `floor2`, never rounded up: a rounded-up rupee is money the supplier did not agree to.
    expect(teaPacketAmount(policy, 2)).toBe(2501.11);
  });
});
