/**
 * M15 Users & roles — the shared half.
 *
 * rbac.md is explicit that §12.1 is **data, not code**: *"a factory will want to split or
 * merge these roles, and that must not be a deploy."* M15 is the screen that edits it, which
 * makes this the one module that can break every other one at once — a role stripped of
 * `usersAndRoles` is a factory that cannot get back in.
 *
 * So the rules here are all about the same failure: **nobody may leave the console with no
 * way back into it.** Three shapes of it, and they are genuinely different:
 *
 *  1. Suspending or demoting the **last** person who can administer users.
 *  2. Doing it to **yourself**, which is wrong even when somebody else remains — the
 *     office loses the person who was mid-task, and it is never what was meant.
 *  3. Editing the **role matrix** so that no role grants `usersAndRoles` at all, which
 *     locks everybody out at once and is the version nobody thinks of.
 *
 * The console checks these so the button is not offered; the server checks them because the
 * console can be lied to (§9.3). Both call the functions below, so the two can never
 * disagree about whether a factory is about to lock itself out.
 */

import type { AccessLevel, Capability, ConsoleRole, ConsoleUser } from './types/admin';
import { can, grantsFromRoles } from './rbac';

/** The capability that gets a factory back into its own console. */
export const RECOVERY_CAPABILITY: Capability = 'usersAndRoles';

/** The level of `RECOVERY_CAPABILITY` that can actually restore access. */
export const RECOVERY_LEVEL: Exclude<AccessLevel, 'none'> = 'write';

/** Enough of a user to judge a lockout. */
export interface LockoutCandidate {
  id: string;
  roles: ConsoleRole[];
  status: ConsoleUser['status'];
}

/**
 * Can this user administer users, given a role matrix?
 *
 * Takes the matrix rather than reading the shipped default, because M15 can **edit** it —
 * and a check written against the compiled-in table would approve a change that the edited
 * matrix makes catastrophic.
 */
export function canAdministerUsers(
  user: Pick<LockoutCandidate, 'roles' | 'status'>,
  matrix?: Record<ConsoleRole, Record<Capability, AccessLevel>>,
): boolean {
  // A suspended administrator is not a way back in. They cannot sign in to use it.
  if (user.status !== 'active') return false;

  if (!matrix) return can(grantsFromRoles(user.roles), RECOVERY_CAPABILITY, RECOVERY_LEVEL);

  // Highest level any of the user's roles grants, read from the matrix being proposed.
  const order: AccessLevel[] = ['none', 'read', 'write', 'approve'];
  const best = user.roles.reduce((highest, role) => {
    const level = matrix[role]?.[RECOVERY_CAPABILITY] ?? 'none';
    return order.indexOf(level) > order.indexOf(highest) ? level : highest;
  }, 'none' as AccessLevel);

  return order.indexOf(best) >= order.indexOf(RECOVERY_LEVEL);
}

/**
 * Would this change leave nobody able to administer users?
 *
 * `next` is the user as they would be **after** the edit — suspended, or with different
 * roles — and `others` is everybody else, unchanged. Returning a boolean rather than
 * throwing so both the console (to withhold a button) and the server (to refuse) can use it
 * without catching.
 */
export function wouldLockOut(
  next: LockoutCandidate,
  others: readonly LockoutCandidate[],
  matrix?: Record<ConsoleRole, Record<Capability, AccessLevel>>,
): boolean {
  if (canAdministerUsers(next, matrix)) return false;
  return !others.some((other) => canAdministerUsers(other, matrix));
}

/**
 * Does this matrix leave **any** role able to administer users?
 *
 * The lockout nobody thinks of: every individual user can keep their roles while the roles
 * themselves stop granting the capability, and the factory is locked out without a single
 * user record having changed.
 */
export function matrixKeepsRecovery(
  matrix: Record<ConsoleRole, Record<Capability, AccessLevel>>,
): boolean {
  const order: AccessLevel[] = ['none', 'read', 'write', 'approve'];
  return Object.values(matrix).some(
    (row) => order.indexOf(row[RECOVERY_CAPABILITY] ?? 'none') >= order.indexOf(RECOVERY_LEVEL),
  );
}

/*
 * **No second factor lives here any more.**
 *
 * `MFA_REQUIRED_ROLES`, `requiresMfa` and `owesMfa` marked manager-and-above as owing a
 * TOTP code, and the factory has withdrawn the requirement: the console is used from
 * shared office machines, and a code on one person's phone stops whoever is at the
 * counter. Nothing replaced them — a password is the whole of console sign-in now, and
 * the protections that remain are the ones that never depended on a second factor: no
 * self-modification, no last-administrator suspension, and every action audited by name.
 */
