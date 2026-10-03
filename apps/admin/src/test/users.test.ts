/**
 * M15 against the mock API.
 *
 * rbac.md says §12.1 is *"data, not code: a factory will want to split or merge these roles,
 * and that must not be a deploy."* This module is that promise, which makes it the one screen
 * that can break every other one at once — so the suite is almost entirely about the refusals
 * that stop a factory locking itself out of its own console.
 *
 * Three shapes of the same failure, and they are genuinely different:
 *
 *  1. **`last-admin` by suspension or demotion** — reported on the row so the control is
 *     withheld, and *unreachable on the server*: the actor needs the very capability at
 *     stake, so they are always a recovery path themselves. Recorded rather than assumed —
 *     see the test.
 *  2. **`self-modification`** — doing it to yourself, refused even when somebody else
 *     remains, because it is never what was meant and it strands the person mid-task.
 *  3. **`last-admin` by matrix edit** — the one nobody thinks of. Every user keeps their
 *     roles while the *roles* stop granting the capability, so a check written per user
 *     misses it entirely and the factory is locked out with no record having changed.
 *
 * And one property that would make all of it cosmetic: a suspension has to actually stop the
 * account signing in. A screen that says "suspended" over an account that still works is
 * worse than no screen.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_MATRIX,
  FACTORY_CONSOLE_CAPABILITIES,
  canAdministerUsers,
  matrixKeepsRecovery,
  wouldLockOut,
  type AccessLevel,
  type Capability,
  type ConsoleRole,
} from '@tfd/domain';
import { userRepository } from '@/services/repositories/userRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

/** The list, plus the lockout context every write needs. */
async function listWithContext() {
  const page = await userRepository.list({ pageSize: 50 });
  const all = page.items.map((one) => ({ id: one.id, roles: one.roles, status: one.status }));
  return { page, context: { all, actingUserId: useAuthStore.getState().user?.id } };
}

describe('M15 users & roles', () => {
  beforeEach(() => {
    signOut();
  });

  it('lists the console users with the two facts a list has to show', async () => {
    await signInAs(ADMIN);
    const { page } = await listWithContext();

    // One per role v2 kept that belongs to a factory: clerk, manager, editor, factory
    // admin. A platform admin spans tenants and is not seeded against this one.
    expect(page.total).toBeGreaterThanOrEqual(4);

    const admin = page.items.find((one) => one.email === ADMIN)!;
    // The fixture's only holder of `usersAndRoles: W`, which is what makes the lockout rules
    // reachable at all — a "last administrator" needs somebody to be the last one.
    expect(admin.canAdministerUsers).toBe(true);
    expect(admin.isLastAdministrator).toBe(true);

    const editor = page.items.find((one) => one.roles.includes('editor'))!;
    expect(editor.canAdministerUsers).toBe(false);
    expect(editor.isLastAdministrator).toBe(false);
  });

  /**
   * **`last-admin` cannot fire for a user action, and finding that out was the point.**
   *
   * Anyone empowered to suspend or demote an administrator needs `usersAndRoles: write` —
   * which is what *being* an administrator means. So the actor is always a recovery path
   * themselves, and removing somebody else can never leave nobody: `wouldLockOut` correctly
   * returns `false` every time. The case that looks like the danger — doing it to your own
   * account — is caught by `self-modification` first.
   *
   * The two rules cover each other, which is why the guard stays: `isLastAdministrator` is
   * still reported so the UI withholds the control, and the rule becomes reachable the moment
   * a factory customises the matrix to give `usersAndRoles: write` to a role that is not an
   * administrator. The reachable server-side lockout is the **matrix** one, below.
   */
  it('reports the only administrator so the control can be withheld', async () => {
    await signInAs(ADMIN);
    const { page, context } = await listWithContext();
    const admin = page.items.find((one) => one.email === ADMIN)!;

    expect(admin.isLastAdministrator).toBe(true);

    // Suspending them means suspending yourself, which is refused as self-modification —
    // the only route to it, given that the actor must hold the very capability at stake.
    await expect(
      userRepository.suspend(admin.id, 'No longer with the factory as of today.', context),
    ).rejects.toMatchObject({ code: 'self-modification' });

    // And the rule itself, in isolation: it is the matrix path that makes it reachable.
    expect(
      wouldLockOut(
        { id: admin.id, roles: admin.roles, status: 'suspended' },
        page.items
          .filter((one) => one.id !== admin.id)
          .map((one) => ({ id: one.id, roles: one.roles, status: one.status })),
      ),
    ).toBe(true);
  }, 20_000);

  it('stops being the only administrator once somebody else holds the role', async () => {
    await signInAs(ADMIN);
    const first = await listWithContext();
    const clerk = first.page.items.find((one) => one.email === CLERK)!;

    // Give the clerk the capability…
    await userRepository.patch(clerk.id, { roles: ['clerk', 'factoryAdmin'] }, first.context);

    // …and the original administrator stops being the only way back in.
    const second = await listWithContext();
    expect(second.page.items.find((one) => one.email === ADMIN)!.isLastAdministrator).toBe(false);

    /**
     * And now the suspension is genuinely possible, done by the newly-promoted clerk — who
     * holds `usersAndRoles: write` and is therefore the recovery path that makes it safe.
     */
    signOut();
    await signInAs(CLERK);
    const third = await listWithContext();
    await expect(
      userRepository.suspend(
        third.page.items.find((one) => one.email === ADMIN)!.id,
        'Handed the administration over to the office clerk this morning.',
        third.context,
      ),
    ).resolves.toMatchObject({ status: 'suspended' });
  }, 30_000);

  it('refuses to act on your own account (self-modification)', async () => {
    await signInAs(ADMIN);
    const { page, context } = await listWithContext();
    const self = page.items.find((one) => one.email === ADMIN)!;

    /**
     * Refused **even when it would be safe**, and that asymmetry with `last-admin` is the
     * point: editing your own roles or suspending yourself mid-session is never what was
     * meant, and the person it strands is the one doing the work.
     */
    await expect(
      userRepository.patch(self.id, { roles: ['clerk'] }, context),
    ).rejects.toMatchObject({ code: 'self-modification' });

    await expect(
      userRepository.suspend(self.id, 'Leaving the factory at the end of the month.', context),
    ).rejects.toMatchObject({ code: 'self-modification' });
  }, 20_000);

  it('makes a suspension actually stop the account signing in', async () => {
    await signInAs(ADMIN);
    const { page, context } = await listWithContext();
    const clerk = page.items.find((one) => one.email === CLERK)!;

    await userRepository.suspend(clerk.id, 'On unpaid leave until the end of the season.', context);

    /**
     * The property that makes every other write in this module mean something. A screen
     * saying "suspended" over an account that still works is worse than no screen — and the
     * only reason this passes is that `bearer()` and the login handler read live state
     * rather than the fixture.
     */
    signOut();
    const refused = await signInAs(CLERK).catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.status).toBe(403);

    // Reactivating puts them back, with the roles they had.
    await signInAs(ADMIN);
    const after = await listWithContext();
    await userRepository.reactivate(
      after.page.items.find((one) => one.email === CLERK)!.id,
      'Back from leave and working the change-request queue again.',
    );

    /**
     * Asserted against a **refetch**, not against the response.
     *
     * The API acknowledges a status change with `{ id, status }` and nothing else, so
     * "did they keep the roles they had" is a question only the record can answer. That is
     * the console's real behaviour too — every mutation hook invalidates and refetches —
     * so reading the list back is what the screen actually does.
     */
    const restored = (await listWithContext()).page.items.find((one) => one.email === CLERK)!;
    expect(restored.status).toBe('active');
    expect(restored.roles).toEqual(['clerk']);

    signOut();
    await expect(signInAs(CLERK)).resolves.toBeUndefined();
  }, 30_000);

  it('refuses a suspension with no reason', async () => {
    await signInAs(ADMIN);
    const { page, context } = await listWithContext();
    const clerk = page.items.find((one) => one.email === CLERK)!;

    // A suspended colleague will ask why, exactly as a suspended supplier does.
    await expect(userRepository.suspend(clerk.id, 'too short', context)).rejects.toMatchObject({
      code: 'note-required',
    });

    // And the same on the way back: a reactivation with no why is a record nobody can read
    // six months later either.
    await expect(
      userRepository.reactivate(clerk.id, 'ok now'),
    ).rejects.toMatchObject({ code: 'note-required' });
  }, 20_000);

  it('refuses a second account on one email', async () => {
    await signInAs(ADMIN);
    // The address is the identity a session is issued against, so two of them is two people.
    await expect(
      userRepository.create({ name: 'Somebody Else', email: CLERK, roles: ['clerk'] }),
    ).rejects.toMatchObject({ code: 'email-taken' });
  });

  it('creates a senior account that can sign in with its password alone', async () => {
    await signInAs(ADMIN);

    const created = await userRepository.create({
      name: 'Nilanthi Herath',
      email: 'nilanthi@galabodatea.lk',
      roles: ['manager'],
    });

    /**
     * A manager used to be created owing a second factor, and the badge saying so was the
     * only trace of a requirement nothing ever collected. The factory has withdrawn it, so
     * the account this call produces is complete: the roles asked for, and a password.
     *
     * The **password is on the response and the record is not** — there is no invitation
     * email, so the office reads the credential out once and the dialog shows it. Anything
     * about the account itself comes from a refetch.
     */
    expect(created.id).toBeTruthy();
    expect(created.password.length).toBeGreaterThanOrEqual(12);

    const row = (await userRepository.list()).items.find((one) => one.id === created.id)!;
    expect(row.roles).toEqual(['manager']);
    expect(row.lastLoginAt).toBeNull();
    expect(row.status).toBe('active');
  }, 20_000);

  it('serves the §12.1 matrix, and marks it as the shipped default until it is changed', async () => {
    await signInAs(ADMIN);
    const served = await userRepository.roles();

    // The default, row for row — `rbac.ts` is what ships and this is what serves it.
    expect(served.matrix).toEqual(DEFAULT_ROLE_MATRIX);
    expect(served.customised).toBe(false);
    expect(served.updatedAt).toBeNull();
  });

  it('edits a role, and the change is the authority (rbac.md)', async () => {
    await signInAs(ADMIN);
    const before = await userRepository.roles();

    // The example rbac.md itself calls out: a manager cannot edit a supplier record, and a
    // factory that wants them to should not need a deploy.
    expect(before.matrix.manager.suppliers).toBe('read');
    await userRepository.setRole(
      'manager',
      { ...before.matrix.manager, suppliers: 'write' },
      before.matrix,
    );

    const after = await userRepository.roles();
    expect(after.matrix.manager.suppliers).toBe('write');
    expect(after.customised).toBe(true);
    /**
     * The name of whoever widened it — **G-10 is closed**. The API stored this and did not
     * send it for a while, so the console had to fill `null` into the one caption anybody
     * reads off this table: *"who changed this, and from what"*.
     */
    expect(after.updatedByName).toBe('Chandima Bandara');
  }, 20_000);

  /**
   * **The property that makes hiding rows safe.**
   *
   * `RoleMatrixView` renders twelve of the fifteen capabilities: `deliveries`,
   * `ratesAndMonthClose` and `payouts` are the factory's own console's, and a dropdown
   * that changes nothing is the same failure as a role that grants nothing. But the
   * server holds those grants, so hiding them must not *drop* them — and the only thing
   * standing between the two is the screen spreading the whole `matrix[role]` when it
   * saves one cell. Asserted here rather than trusted, because the day somebody sends a
   * narrower payload the loss is silent and lands on the other console.
   */
  it('preserves the capabilities M15 does not render when a visible one is edited', async () => {
    await signInAs(ADMIN);
    const before = await userRepository.roles();

    // Exactly what `RoleMatrixView.change()` builds for one cell.
    await userRepository.setRole(
      'clerk',
      { ...before.matrix.clerk, inquiries: 'read' },
      before.matrix,
    );

    const after = await userRepository.roles();
    expect(after.matrix.clerk.inquiries).toBe('read');
    for (const capability of FACTORY_CONSOLE_CAPABILITIES) {
      expect(after.matrix.clerk[capability]).toBe(before.matrix.clerk[capability]);
    }
  }, 20_000);

  it('refuses a matrix edit that would leave no role able to administer users', async () => {
    await signInAs(ADMIN);
    const before = await userRepository.roles();

    /**
     * The lockout nobody thinks of. Every user keeps every role they had; the roles simply
     * stop granting the capability, and the factory is locked out with no user record
     * changed. A guard written per user would approve this without hesitating.
     */
    const holders = (Object.keys(before.matrix) as ConsoleRole[]).filter((role) =>
      ['write', 'approve'].includes(before.matrix[role].usersAndRoles),
    );
    expect(holders.length).toBeGreaterThan(0);

    // Strip it from all but the last one — still fine.
    let matrix = before.matrix;
    for (const role of holders.slice(0, -1)) {
      await userRepository.setRole(role, { ...matrix[role], usersAndRoles: 'none' }, matrix);
      matrix = (await userRepository.roles()).matrix;
    }

    // The last one is refused.
    const last = holders.at(-1)!;
    await expect(
      userRepository.setRole(last, { ...matrix[last], usersAndRoles: 'none' }, matrix),
    ).rejects.toMatchObject({ code: 'last-admin' });
  }, 30_000);

  it('refuses a role that is not in §12.1', async () => {
    await signInAs(ADMIN);
    const before = await userRepository.roles();
    // A grant nothing can hold is a permission nobody has.
    await expect(
      userRepository.setRole(
        'superuser' as ConsoleRole,
        before.matrix.clerk,
        before.matrix,
      ),
    ).rejects.toMatchObject({ code: 'unknown-role' });
  });

  it('audits every write, with the roles before and after (AC-09)', async () => {
    await signInAs(ADMIN);
    const { page, context } = await listWithContext();
    const editor = page.items.find((one) => one.roles.includes('editor'))!;
    await userRepository.patch(editor.id, { roles: ['editor', 'clerk'] }, context);

    signOut();
    await signInAs(MANAGER);
    const trail = await auditRepository.forEntity('consoleUser', editor.id);
    const entry = trail.items.find((one) => one.action === 'user.update');

    /**
     * A permission change is the one edit whose consequence is invisible until somebody is
     * refused something months later. "Who widened this, and from what" is the only question
     * ever asked about it.
     */
    expect(entry).toBeTruthy();
    expect(entry!.before).toMatchObject({ roles: ['editor'] });
    expect(entry!.after).toMatchObject({ roles: ['editor', 'clerk'] });
  }, 30_000);

  it('gives a manager read access and refuses them every write (§12.1)', async () => {
    await signInAs(MANAGER);
    const { page, context } = await listWithContext();
    expect(page.total).toBeGreaterThan(0);
    await expect(userRepository.roles()).resolves.toBeTruthy();

    // §12.1 gives the manager `usersAndRoles: R`. Reading who has access is theirs; changing
    // it is the factory administrator's.
    const refused = await userRepository
      .create({ name: 'Nobody', email: 'nobody@galabodatea.lk', roles: ['clerk'] })
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');

    const editor = page.items.find((one) => one.roles.includes('editor'))!;
    const alsoRefused = await userRepository
      .patch(editor.id, { name: 'Renamed' }, context)
      .catch((cause: unknown) => cause);
    expect(isApiError(alsoRefused) && alsoRefused.code).toBe('forbidden');
  }, 20_000);

  it('gives a clerk no access to users at all (§12.1)', async () => {
    await signInAs(CLERK);
    const refused = await userRepository.list().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  });
});

/**
 * The shared rules, in isolation.
 *
 * Worth testing away from the API because they are what both sides call: a disagreement here
 * would mean the console withholding a button the server allows, or offering one that bricks
 * the factory.
 */
describe('lockout rules', () => {
  const admin = { id: 'a', roles: ['factoryAdmin'] as ConsoleRole[], status: 'active' as const };
  const clerk = { id: 'b', roles: ['clerk'] as ConsoleRole[], status: 'active' as const };

  it('does not count a suspended administrator as a way back in', () => {
    // They cannot sign in to use it, so they are not a recovery path.
    expect(canAdministerUsers({ ...admin, status: 'suspended' })).toBe(false);
    expect(canAdministerUsers(admin)).toBe(true);
  });

  it('reads the matrix it is given, not the shipped one', () => {
    const stripped = {
      ...DEFAULT_ROLE_MATRIX,
      factoryAdmin: { ...DEFAULT_ROLE_MATRIX.factoryAdmin, usersAndRoles: 'none' as AccessLevel },
    };
    // The whole reason the matrix is a parameter: M15 can edit it, and a check written
    // against the compiled-in table would approve a change the edited one makes fatal.
    expect(canAdministerUsers(admin)).toBe(true);
    expect(canAdministerUsers(admin, stripped)).toBe(false);
  });

  it('blocks only when nobody else is left', () => {
    expect(wouldLockOut({ ...admin, status: 'suspended' }, [clerk])).toBe(true);
    expect(wouldLockOut({ ...admin, status: 'suspended' }, [clerk, { ...admin, id: 'c' }])).toBe(
      false,
    );
  });

  it('spots a matrix with no recovery role at all', () => {
    expect(matrixKeepsRecovery(DEFAULT_ROLE_MATRIX)).toBe(true);

    const dead = Object.fromEntries(
      (Object.keys(DEFAULT_ROLE_MATRIX) as ConsoleRole[]).map((role) => [
        role,
        { ...DEFAULT_ROLE_MATRIX[role], usersAndRoles: 'none' as AccessLevel },
      ]),
    ) as Record<ConsoleRole, Record<Capability, AccessLevel>>;
    expect(matrixKeepsRecovery(dead)).toBe(false);

    // `read` is not enough: seeing who has access does not let you restore it.
    const readOnly = Object.fromEntries(
      (Object.keys(DEFAULT_ROLE_MATRIX) as ConsoleRole[]).map((role) => [
        role,
        { ...DEFAULT_ROLE_MATRIX[role], usersAndRoles: 'read' as AccessLevel },
      ]),
    ) as Record<ConsoleRole, Record<Capability, AccessLevel>>;
    expect(matrixKeepsRecovery(readOnly)).toBe(false);
  });

});
