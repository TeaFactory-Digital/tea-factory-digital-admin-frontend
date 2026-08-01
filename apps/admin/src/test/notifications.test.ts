/**
 * M13 against the mock API.
 *
 * A push is the only act in this console with **no undo and no delivery report**. Nothing
 * comes back from a phone to say the message was dropped, and no supplier tells the office
 * they had the category switched off — so every safeguard is a pre-check, and every one of
 * them is asserted here:
 *
 *  - **`unknown-category`**, the refusal with nothing behind it. The app *drops* a push
 *    whose category it does not recognize rather than opening an arbitrary screen, so a
 *    send the console called successful would reach nobody and report nothing at all.
 *  - **Per-device consent honoured**, not just topic membership (api-contract §17). A
 *    suppressed device is counted, never silently filtered — "sent to 240" when 90 opted
 *    out is a number the office would act on wrongly.
 *  - **`no-recipients`** refused rather than logged green, because somebody is standing at
 *    the screen and can put it on the noticeboard instead.
 *  - **`push-not-configured`**, which `hillcountry` reaches for real: the flag is on and
 *    the tenant has no categories at all.
 *
 * And the half that makes §21.24 survivable: **automatic sends fire off the event that
 * owns them, and only when the factory's trigger is on.** Both directions are asserted,
 * because a trigger that cannot be turned off is not a setting.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  isRecognizedCategory,
  partitionDevices,
} from '@tfd/domain';
import { notificationRepository } from '@/services/repositories/notificationRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { newsRepository } from '@/services/repositories/contentRepository';
import { inquiryRepository } from '@/services/repositories/inquiryRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const EDITOR = 'editor@galabodatea.lk';
const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

describe('M13 notifications', () => {
  beforeEach(() => {
    signOut();
  });

  it('names the event each category fires from, and defaults from the tenant’s own config', async () => {
    await signInAs(ADMIN);
    const triggers = await notificationRepository.triggers();

    expect(triggers.map((one) => one.category).sort()).toEqual([...NOTIFICATION_CATEGORIES].sort());
    for (const trigger of triggers) {
      // The event is a fact about the system, not a policy about the factory.
      expect(trigger.event).toBe(NOTIFICATION_EVENTS[trigger.category]);
      expect(trigger.available).toBe(true);
    }

    /**
     * The defaults are read from `push.defaultCategories`, which is the platform already
     * saying which categories are routine — `newsArticle` is pointedly not among them.
     * That is the closest thing to an answer to §21.24 that exists, and using it is the
     * difference between deferring the question and guessing at it.
     */
    const on = triggers.filter((one) => one.enabled).map((one) => one.category).sort();
    expect(on).toEqual(['billPublished', 'inquiryReplied', 'requestDecided']);
    expect(triggers.find((one) => one.category === 'newsArticle')?.enabled).toBe(false);
  });

  it('counts devices that opted out rather than filtering them away', async () => {
    await signInAs(ADMIN);

    const reach = await notificationRepository.reach('newsArticle', { kind: 'allSuppliers' });

    // The fixture is built so news reaches far fewer phones than a bill does, because
    // `newsArticle` is not in `defaultCategories`. That asymmetry is the behaviour the
    // contract's second push rule is about.
    const bills = await notificationRepository.reach('billPublished', { kind: 'allSuppliers' });
    expect(reach.reachableDevices).toBeLessThan(bills.reachableDevices);
    expect(reach.suppressedDevices).toBeGreaterThan(0);

    // Suppressed and no-device are different problems with different fixes, so they are
    // different numbers.
    expect(reach.suppliersWithoutDevice).toBeGreaterThan(0);
    expect(reach.targetedSuppliers).toBeGreaterThan(reach.reachableDevices);
  });

  it('narrows the audience to one collection point', async () => {
    await signInAs(ADMIN);

    const all = await notificationRepository.reach('billPublished', { kind: 'allSuppliers' });
    const point = await notificationRepository.reach('billPublished', {
      kind: 'collectionPoint',
      collectionPoint: 'MAKADURA',
    });

    expect(point.targetedSuppliers).toBeGreaterThan(0);
    expect(point.targetedSuppliers).toBeLessThan(all.targetedSuppliers);
  });

  it('refuses a category the app would throw away', async () => {
    await signInAs(ADMIN);

    // Refused before it leaves the browser, and the *reason* survives: a zod enum failure
    // says "invalid enum value", which does not explain why nothing happened.
    await expect(
      notificationRepository.send({
        // Cast through `never`: the whole point is that this category does not exist in
        // the union, so there is no honest way to write it.
        category: 'factoryClosed' as never,
        title: 'Factory closed tomorrow',
        body: 'The factory will not weigh leaf tomorrow.',
        audience: { kind: 'allSuppliers' },
      }),
    ).rejects.toMatchObject({ code: 'unknown-category' });

    expect(isRecognizedCategory('factoryClosed')).toBe(false);
    expect(isRecognizedCategory('billPublished')).toBe(true);
  });

  it('sends a composed notification and records what it reached', async () => {
    await signInAs(ADMIN);

    const before = await notificationRepository.reach('billPublished', {
      kind: 'collectionPoint',
      collectionPoint: 'MAKADURA',
    });

    const send = await notificationRepository.send({
      category: 'billPublished',
      title: 'Accounts ready at the Makadura counter',
      body: 'July accounts can be collected from the Makadura counter from Monday morning.',
      audience: { kind: 'collectionPoint', collectionPoint: 'MAKADURA' },
    });

    expect(send.origin).toBe('composed');
    expect(send.createdByName).toBe('Chandima Bandara');
    expect(send.status).toBe('sent');
    // The counts on the record are the ones the reach preview showed, which is what makes
    // the preview worth trusting.
    expect(send.reachableDevices).toBe(before.reachableDevices);
    expect(send.suppressedDevices).toBe(before.suppressedDevices);

    const log = await notificationRepository.list({ origin: 'composed', pageSize: 10 });
    expect(log.items[0]?.id).toBe(send.id);
  }, 20_000);

  it('refuses a send nobody would receive', async () => {
    await signInAs(ADMIN);

    /**
     * Refused rather than logged as sent, and the asymmetry with an automatic send is
     * deliberate: somebody is standing at this screen, so telling them the message went
     * nowhere is information they can act on. A green row in the log is a lie they would
     * believe.
     */
    const supplierWithNoDevice = 'sup-5'; // one in five never installed the app
    await expect(
      notificationRepository.send({
        category: 'billPublished',
        title: 'A message for nobody',
        body: 'This audience has no reachable device at all.',
        audience: { kind: 'supplier', supplierId: supplierWithNoDevice },
      }),
    ).rejects.toMatchObject({ code: 'no-recipients' });
  });

  it('refuses a tenant that has push on and nothing configured', async () => {
    await signInAs(ADMIN);
    const token = useAuthStore.getState().accessToken;

    /**
     * `hillcountry` really is in this state: `enablePushNotifications: true` and **no
     * `push` block at all**. The flag is on and nobody has set the module up, which is a
     * real answer rather than a fixture oversight — and the console must say so rather
     * than send into a void.
     */
    const response = await fetch('http://localhost/admin/notifications/triggers', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'hillcountry' },
    });
    const triggers = (await response.json()) as Array<{ available: boolean }>;
    expect(response.status).toBe(200);
    expect(triggers.every((one) => one.available === false)).toBe(true);

    const send = await fetch('http://localhost/admin/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant': 'hillcountry',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: 'billPublished',
        title: 'Anything',
        body: 'Anything at all.',
        audience: { kind: 'allSuppliers' },
      }),
    });
    expect(send.status).toBe(409);
    expect(await send.json()).toMatchObject({ code: 'push-not-configured' });
  });

  it('refuses the whole module for a tenant with the flag off (AC-07)', async () => {
    await signInAs(ADMIN);
    const token = useAuthStore.getState().accessToken;

    // `highland` has `enablePushNotifications: false`. The console hides the row; this is
    // the half a replayed request cannot get past.
    const response = await fetch('http://localhost/admin/notifications', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'highland' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'feature-disabled' });
  });

  it('lets an editor read and refuses them the send (§12.1)', async () => {
    await signInAs(EDITOR);

    // `content: W` — the log is readable…
    await expect(notificationRepository.list({ pageSize: 1 })).resolves.toBeTruthy();
    await expect(notificationRepository.triggers()).resolves.toBeTruthy();

    /**
     * …and sending is not. This is the console's answer to §21.24's second half — "who
     * may send free text" — and it is the same boundary M11 draws: writing a circular is
     * an editor's job, putting it on every supplier's lock screen is not.
     */
    const refused = await notificationRepository
      .send({
        category: 'billPublished',
        title: 'Not mine to send',
        body: 'An editor should not be able to reach every supplier’s phone.',
        audience: { kind: 'allSuppliers' },
      })
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  });

  it('writes an audit entry for a send and for a trigger change (AC-09)', async () => {
    await signInAs(ADMIN);
    await notificationRepository.setTrigger('newsArticle', true);
    await notificationRepository.send({
      category: 'billPublished',
      title: 'Counter open on Saturday',
      body: 'The office counter is open until noon on Saturday for account collection.',
      audience: { kind: 'allSuppliers' },
    });

    signOut();
    await signInWithMfaAs(MANAGER);
    const trail = await auditRepository.list({ pageSize: 200 });
    const actions = trail.items.map((entry) => entry.action);
    expect(actions).toContain('notification.send');
    expect(actions).toContain('notification.trigger.set');

    const sent = trail.items.find((entry) => entry.action === 'notification.send');
    // The reach is in the entry, because "how many people did that actually go to" is the
    // question asked afterwards and nothing else can answer it.
    expect(sent?.after).toMatchObject({ category: 'billPublished' });
    expect((sent?.after as { reachableDevices: number }).reachableDevices).toBeGreaterThan(0);
  }, 20_000);
});

/**
 * The automatic half — §21.24 deferred rather than guessed.
 *
 * Each of these fires from the module that owns the event, so the assertions are made by
 * doing the real thing: publishing a month, publishing an article, answering a message.
 */
describe('M13 automatic triggers', () => {
  beforeEach(() => {
    signOut();
  });

  async function sendsFor(category: string) {
    const log = await notificationRepository.list({ pageSize: 100 });
    return log.items.filter((send) => send.category === category && send.origin === 'automatic');
  }

  it('fires billPublished when a month is published, once', async () => {
    // The baseline is read by somebody who *can* read it: the accountant holds
    // `ratesAndMonthClose: W` and no `content` grant at all, which is the matrix working
    // rather than a gap — the person who closes a month is not the person who reads the
    // notification log.
    await signInAs(ADMIN);
    const before = await sendsFor('billPublished');

    signOut();
    await signInAs(ACCOUNTANT);
    const months = await monthRepository.list();
    const open = months.items.find((month) => month.open)!;

    await monthRepository.setRate(open.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    const exceptions = await monthRepository.exceptions(open.monthKey, { resolved: false });
    await Promise.all(
      exceptions.items.map((exception) =>
        monthRepository.resolveException(
          open.monthKey,
          exception.id,
          'Checked against the counter records and accepted for this month.',
        ),
      ),
    );
    await billRepository.generate(open.monthKey);

    signOut();
    await signInWithMfaAs(MANAGER);
    await monthRepository.publish(open.monthKey);

    signOut();
    await signInAs(ADMIN);
    const after = await sendsFor('billPublished');

    expect(after.length).toBe(before.length + 1);
    const fired = after[0]!;
    expect(fired.origin).toBe('automatic');
    // Nobody pressed anything, so nobody is credited.
    expect(fired.createdById).toBeNull();
    expect(fired.entity).toBe('monthlyRate');
    expect(fired.entityId).toBe(open.monthKey);
    expect(fired.reachableDevices).toBeGreaterThan(0);
  }, 40_000);

  it('does not fire a trigger the factory has turned off', async () => {
    await signInAs(ADMIN);
    // `newsArticle` is off by default here — see `push.defaultCategories`.
    const before = await sendsFor('newsArticle');

    signOut();
    await signInAs(EDITOR);
    const article = await newsRepository.create({
      translations: [
        { lang: 'en', title: 'Counter closed on Friday', body: 'The office counter is closed.' },
      ],
    });

    signOut();
    await signInAs(ADMIN);
    await newsRepository.publish(article.id);
    expect((await sendsFor('newsArticle')).length).toBe(before.length);

    /**
     * Turn it on and publish another. This is the whole point of the trigger record: the
     * factory's answer to §21.24 is a switch, and a switch that cannot be observed to
     * change behaviour is not a switch.
     */
    await notificationRepository.setTrigger('newsArticle', true);

    signOut();
    await signInAs(EDITOR);
    const second = await newsRepository.create({
      translations: [
        { lang: 'en', title: 'Counter open on Saturday', body: 'Open until noon on Saturday.' },
      ],
    });

    signOut();
    await signInAs(ADMIN);
    await newsRepository.publish(second.id);

    const after = await sendsFor('newsArticle');
    expect(after.length).toBe(before.length + 1);
    // The headline is the fallback language's copy — a push carries one string.
    expect(after[0]?.title).toBe('Counter open on Saturday');
    expect(after[0]?.entityId).toBe(second.id);
  }, 40_000);

  it('fires inquiryReplied to the one supplier who asked, without the answer in it', async () => {
    await signInAs(CLERK);
    const open = await inquiryRepository.list({ status: 'open', pageSize: 5 });
    const inquiry = open.items[0]!;

    const reply =
      'We have checked the second weighing on the 12th and added 96 kg to your July account.';
    await inquiryRepository.reply(inquiry.id, { body: reply });

    signOut();
    await signInAs(ADMIN);
    const sends = await sendsFor('inquiryReplied');
    const fired = sends.find((send) => send.entityId === inquiry.id)!;

    expect(fired).toBeTruthy();
    expect(fired.audience).toMatchObject({ kind: 'supplier', supplierId: inquiry.supplierId });
    expect(fired.targetedSuppliers).toBe(1);

    /**
     * **The reply itself is not in the push**, and that is the point of asserting it: a
     * lock screen is read by whoever is holding the phone, and an answer can name a bank
     * account or a dispute. The notification says there is an answer; the app shows it.
     */
    expect(fired.body).not.toContain('96 kg');
    expect(fired.body).toContain(inquiry.subject);
  }, 30_000);

  it('fires requestDecided without the decision note', async () => {
    await signInWithMfaAs(MANAGER);
    const { changeRequestRepository } = await import(
      '@/services/repositories/changeRequestRepository'
    );
    const queue = await changeRequestRepository.list({ status: 'pending', pageSize: 10 });
    const target = queue.items.find((request) => request.createdById === null)!;

    await changeRequestRepository.reject(target.id, {
      note: 'The account name does not match the registered supplier name. Bring the passbook.',
    });

    signOut();
    await signInAs(ADMIN);
    const fired = (await sendsFor('requestDecided')).find(
      (send) => send.entityId === target.id,
    )!;

    expect(fired).toBeTruthy();
    expect(fired.audience).toMatchObject({ kind: 'supplier', supplierId: target.supplierId });
    // The note is written *to* the supplier and can say why a bank change was refused.
    // It belongs in the app, not on a lock screen.
    expect(fired.body).not.toContain('passbook');
  }, 30_000);
});

describe('partitionDevices (the contract’s second push rule)', () => {
  it('splits on the device’s own category list, not on topic membership', () => {
    const devices = [
      { id: 'a', token: 't', platform: 'android' as const, categories: ['billPublished' as const], registeredAt: '' },
      { id: 'b', token: 't', platform: 'ios' as const, categories: ['newsArticle' as const], registeredAt: '' },
    ];

    const bills = partitionDevices(devices, 'billPublished');
    expect(bills.reachable.map((one) => one.id)).toEqual(['a']);
    // Counted, not dropped. The difference between the two figures is the only place a
    // factory ever sees its own opt-out rate.
    expect(bills.suppressed.map((one) => one.id)).toEqual(['b']);
  });
});
