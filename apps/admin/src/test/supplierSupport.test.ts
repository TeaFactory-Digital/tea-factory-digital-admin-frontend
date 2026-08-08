/**
 * The three v2 supplier-support surfaces, against the mock API.
 *
 * All three close the same class of failure: **a fact the console held and could not
 * show for one person.** The month history was reachable only month-first, the push
 * diagnosis only in aggregate, and the supplier's own writes not at all — so the office
 * could hold every number a supplier was asking about and still be unable to answer.
 *
 * What gets asserted is mostly **identities against the records the figures came from**,
 * because a support screen that agreed with nothing would still render.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { billRepository } from '@/services/repositories/billRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const EDITOR = 'editor@galabodatea.lk';
const FACTORY_ADMIN = 'factoryadmin@galabodatea.lk';

/** A supplier with an account, which is what every case here needs. */
async function supplierWithBills() {
  const page = await supplierRepository.list({ pageSize: 50 });
  for (const row of page.items) {
    const history = await supplierRepository.income(row.id);
    if (history.months.length > 0) return { id: row.id, history };
  }
  throw new Error('fixture has no supplier with bills');
}

describe('M2 · a supplier’s month history', () => {
  beforeEach(() => {
    signOut();
  });

  it('answers with one supplier across months — the axis M5 does not have', async () => {
    await signInAs(CLERK);
    const { id, history } = await supplierWithBills();

    expect(history.supplierId).toBe(id);
    expect(history.months.length).toBeGreaterThan(0);
    // Every month belongs to the requested year, and to this supplier only.
    for (const month of history.months) {
      expect(Number(month.monthKey.slice(0, 4))).toBe(history.year);
    }
  });

  it('returns the months oldest first, because a chart reads left to right', async () => {
    await signInAs(CLERK);
    const { history } = await supplierWithBills();

    const keys = history.months.map((one) => one.monthKey);
    expect([...keys].sort()).toEqual(keys);
  });

  it('resolves an absent or unknown year to the newest with data', async () => {
    await signInAs(CLERK);
    const { id, history } = await supplierWithBills();

    // `years` is descending, so the newest is first — and that is what an unspecified
    // request must land on. An empty series would read as "this supplier delivered
    // nothing", which is the one wrong answer this endpoint can give.
    expect(history.year).toBe(history.years[0]);

    const nonsense = await supplierRepository.income(id, 1998);
    expect(nonsense.year).toBe(history.years[0]);
    expect(nonsense.months.length).toBeGreaterThan(0);
  });

  it('keeps an unsettled month as null, never as zero (BR-102)', async () => {
    await signInAs(CLERK);
    const { history } = await supplierWithBills();

    for (const month of history.months) {
      if (month.auctionResultAvailable) continue;
      /**
       * The distinction the whole screen is built on: a month awaiting its auction
       * result has no gross and no balance. A zero would tell a supplier they earned
       * nothing, and the console renders a "pending" badge from exactly this.
       */
      expect(month.grossAmount).toBeNull();
      expect(month.finalBalance).toBeNull();
      // Kilos are known whether or not the rate is.
      expect(month.totalKgs).toBeGreaterThanOrEqual(0);
    }
  });

  it('agrees with the bill each month resolves to', async () => {
    await signInAs(CLERK);
    const { history } = await supplierWithBills();
    const month = history.months.find((one) => one.billId && one.grossAmount != null);
    expect(month).toBeDefined();

    // An identity, not a fixed number: the summary is a projection of the bill, and the
    // two disagreeing is precisely what a supplier reading their phone would catch.
    const bill = await billRepository.get(month!.billId!);
    expect(bill.monthKey).toBe(month!.monthKey);
    expect(bill.totalKgs).toBe(month!.totalKgs);
    expect(bill.grossAmount).toBe(month!.grossAmount);
    expect(bill.balanceAmount).toBe(month!.finalBalance);
  });

  it('filters the bills list to one supplier — v2’s new query', async () => {
    await signInAs(CLERK);
    const { id } = await supplierWithBills();

    const page = await billRepository.list({ supplierId: id, pageSize: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((row) => row.supplierId === id)).toBe(true);
  });
});

describe('M2 · why a push does or does not reach this supplier', () => {
  beforeEach(() => {
    signOut();
  });

  it('names the reason per category rather than reporting a count', async () => {
    await signInAs(CLERK);
    const page = await supplierRepository.list({ hasApp: true, pageSize: 5 });
    const status = await supplierRepository.notifications(page.items[0]!.id);

    expect(status.hasApp).toBe(true);
    expect(status.devices.length).toBeGreaterThan(0);

    for (const reach of status.categories) {
      // `reachable` is a conclusion drawn from the two facts beside it, never an
      // independent field — the console prints the working, so it has to add up.
      expect(reach.reachable).toBe(reach.offeredByFactory && reach.acceptedOnSomeDevice);
      expect(reach.acceptedOnSomeDevice).toBe(reach.deviceCount > 0);
    }
  });

  it('lists every platform category, not only the ones this factory sends', async () => {
    await signInAs(CLERK);
    const page = await supplierRepository.list({ hasApp: true, pageSize: 5 });
    const status = await supplierRepository.notifications(page.items[0]!.id);

    /**
     * "The factory does not send this kind" is a **real answer** to "why didn't I get
     * it", and a different one from an opt-out with a different fix — M14 rather than
     * the supplier's phone. Listing only the offered categories would silently drop the
     * case from the panel.
     */
    expect(status.categories.map((one) => one.category)).toEqual(
      expect.arrayContaining(['billPublished', 'requestDecided', 'newsArticle', 'inquiryReplied']),
    );
  });

  it('says "no device" for a supplier who never installed it, and stops there', async () => {
    await signInAs(CLERK);
    const page = await supplierRepository.list({ hasApp: false, pageSize: 5 });
    const status = await supplierRepository.notifications(page.items[0]!.id);

    expect(status.hasApp).toBe(false);
    expect(status.devices).toEqual([]);
    // Nothing can reach them, so nothing claims to.
    expect(status.categories.every((one) => !one.reachable)).toBe(true);
  });

  it('never puts a push token on the wire', async () => {
    await signInAs(CLERK);
    const page = await supplierRepository.list({ hasApp: true, pageSize: 5 });
    const status = await supplierRepository.notifications(page.items[0]!.id);

    // A credential, and nothing in the office can act on one — §20.4's argument about
    // account numbers, applied to the thing that identifies a phone.
    for (const device of status.devices) {
      expect(device).not.toHaveProperty('token');
    }
  });

  it('404s a supplier that does not exist', async () => {
    await signInAs(CLERK);
    const refused = await supplierRepository
      .notifications('sup-does-not-exist')
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('404');
  });

  it('refuses a role with no supplier grant (§12.1)', async () => {
    await signInAs(EDITOR);
    const refused = await supplierRepository
      .notifications('sup-1')
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  });
});

describe('M17 · what the supplier did themselves', () => {
  beforeEach(() => {
    signOut();
  });

  it('records a supplier’s own profile edit on the same timeline as the office’s actions', async () => {
    await signInWithMfaAs(MANAGER);
    const page = await auditRepository.list({ actorType: 'supplier', pageSize: 50 });

    expect(page.items.length).toBeGreaterThan(0);
    for (const entry of page.items) {
      expect(entry.actorType).toBe('supplier');
      /**
       * A phone on a mobile network has no address the office can act on. `null` rather
       * than an invented value, so the column never looks meaningful when it is not.
       */
      expect(entry.ip).toBeNull();
    }

    // The change the app makes with no approval and no change request — the whole
    // reason this actor type exists.
    expect(page.items.some((one) => one.action === 'supplier.profile.update')).toBe(true);
  });

  it('shows the supplier’s own actions on their record, beside the office’s', async () => {
    await signInWithMfaAs(MANAGER);
    const page = await auditRepository.forEntity('supplier', 'sup-7');

    const actors = new Set(page.items.map((one) => one.actorType ?? 'consoleUser'));
    // Interleaved on one timeline, deliberately: "what we did to this account" and
    // "what they did" are two readings of one history.
    expect(actors.has('supplier')).toBe(true);
  });

  it('treats an entry with no actorType as an office action', async () => {
    await signInWithMfaAs(MANAGER);
    const office = await auditRepository.list({ actorType: 'consoleUser', pageSize: 50 });

    /**
     * Every v1 entry was written by somebody signed into this console, so an absent
     * `actorType` means `consoleUser`. Defaulting the **filter** rather than backfilling
     * the data is what keeps an old row readable.
     */
    expect(office.items.length).toBeGreaterThan(0);
    expect(office.items.every((one) => (one.actorType ?? 'consoleUser') === 'consoleUser')).toBe(
      true,
    );
    expect(office.items.some((one) => one.actorType === 'supplier')).toBe(false);
  });

  it('stamps consoleUser on an action taken through the console', async () => {
    // The **factory administrator**, not the manager: §12.1 gives the manager
    // `flagsAndBranding: read` only, so a manager saving config would be refused before
    // any audit entry existed to assert on.
    await signInAs(FACTORY_ADMIN);
    // Any audited mutation will do; a config save is the cheapest that always works.
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch(
      { factory: { supportHours: 'Mon–Sat, 8am – 5pm' } },
      config,
      usage,
    );

    const page = await auditRepository.list({ pageSize: 5 });
    const newest = page.items[0]!;
    expect(newest.actorType).toBe('consoleUser');
  });
});
