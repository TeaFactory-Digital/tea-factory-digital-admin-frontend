/**
 * M15 gateway.
 *
 * The guards run the **shared** lockout functions from `@tfd/domain/users.ts`, which is what
 * the server refuses with. That matters more here than anywhere else in this layer: the
 * console has to withhold a "suspend" button from the last administrator, and if it decided
 * that differently from the API it would either offer a button that bricks the factory or
 * hide one that was safe.
 *
 * Every guard is `async`, so a refusal **rejects** rather than throwing synchronously. Every
 * screen handles refusals with `.catch()`, and a synchronous throw from an argument position
 * reaches them as an uncaught exception instead — the defect the content suite caught in
 * `contentRepository`.
 */

import {
  matrixKeepsRecovery,
  wouldLockOut,
  type AccessLevel,
  type AdminConsoleUser,
  type Capability,
  type ConsoleRole,
  type ConsoleUserDraft,
  type ConsoleUserPatch,
  type LockoutCandidate,
  type Paged,
  type RoleMatrix,
  type UserQuery,
} from '@tfd/domain';
import { userEndpoints } from '../endpoints/users';
import { ApiError } from '../api/errors';

const lockout = (details: unknown) =>
  new ApiError({
    code: 'last-admin',
    message: 'That would leave nobody able to administer users.',
    details,
  });

const selfModification = (what: string) =>
  new ApiError({
    code: 'self-modification',
    message: 'You cannot do that to your own account.',
    details: { what },
  });

const REASON_MIN = 10;

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < REASON_MIN) {
    throw new ApiError({
      code: 'note-required',
      message: 'A reason is required.',
      details: { min: REASON_MIN },
    });
  }
  return trimmed;
}

export const userRepository = {
  list: (query: UserQuery = {}): Promise<Paged<AdminConsoleUser>> =>
    userEndpoints.list({ page: 0, pageSize: 50, ...query }),

  create: (body: ConsoleUserDraft): Promise<AdminConsoleUser> => userEndpoints.create(body),

  /**
   * Change a name or a set of roles.
   *
   * `all` and `actingUserId` are passed in because the *decision* needs the whole set — "is
   * this the last administrator" is not a property of one record. The screen already holds
   * the list it is rendering, so this costs nothing and keeps the check identical to the
   * server's.
   */
  patch: async (
    id: string,
    body: ConsoleUserPatch,
    context: { all: readonly LockoutCandidate[]; actingUserId: string | undefined },
  ): Promise<AdminConsoleUser> => {
    if (body.roles && id === context.actingUserId) {
      // Refused even when it would be safe. Editing your own roles mid-session is never
      // what was meant, and the person it strands is the one doing the work.
      throw selfModification('roles');
    }

    const target = context.all.find((one) => one.id === id);
    if (body.roles && target) {
      const next: LockoutCandidate = { ...target, roles: body.roles };
      const others = context.all.filter((one) => one.id !== id);
      if (wouldLockOut(next, others)) throw lockout({ userId: id, roles: body.roles });
    }

    return userEndpoints.patch(id, body);
  },

  suspend: async (
    id: string,
    reason: string,
    context: { all: readonly LockoutCandidate[]; actingUserId: string | undefined },
  ): Promise<AdminConsoleUser> => {
    if (id === context.actingUserId) throw selfModification('suspend');

    const target = context.all.find((one) => one.id === id);
    if (target) {
      const next: LockoutCandidate = { ...target, status: 'suspended' };
      const others = context.all.filter((one) => one.id !== id);
      if (wouldLockOut(next, others)) throw lockout({ userId: id });
    }

    return userEndpoints.suspend(id, requireReason(reason));
  },

  reactivate: async (id: string, reason: string): Promise<AdminConsoleUser> =>
    userEndpoints.reactivate(id, requireReason(reason)),

  resetMfa: async (
    id: string,
    reason: string,
    context: { actingUserId: string | undefined },
  ): Promise<AdminConsoleUser> => {
    // Resetting your own second factor is not recovery — it is dropping it while holding a
    // live session, which is the move an attacker with a stolen session makes.
    if (id === context.actingUserId) throw selfModification('mfa');
    return userEndpoints.resetMfa(id, requireReason(reason));
  },

  roles: (): Promise<RoleMatrix> => userEndpoints.roles(),

  /**
   * Edit one role's grants.
   *
   * The guard is the lockout that changes no user record: strip `usersAndRoles` from every
   * role and the factory is locked out with every user still holding the roles they had.
   */
  setRole: async (
    role: ConsoleRole,
    grants: Record<Capability, AccessLevel>,
    currentMatrix: Record<ConsoleRole, Record<Capability, AccessLevel>>,
  ): Promise<RoleMatrix> => {
    const proposed = { ...currentMatrix, [role]: grants };
    if (!matrixKeepsRecovery(proposed)) {
      throw lockout({ role, reason: 'no role would grant usersAndRoles' });
    }
    return userEndpoints.setRole(role, grants);
  },
};
