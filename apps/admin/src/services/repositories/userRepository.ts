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
import { paginate, type MutationAck, type StatusAck } from '../api/adapters';
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

/**
 * The first password for a new console account.
 *
 * There is **no invitation flow** — no email is sent, and the API requires a password on
 * creation (gap **G-02**). So one is minted here and handed back to the dialog to read out
 * once, which is the pattern §21.16 already established for supplier credentials and the
 * one the office copy has always described: *"Tell them their password."*
 *
 * Minted in the browser rather than typed by the administrator on purpose. A human-chosen
 * first password for somebody else is chosen to be easy to say down a corridor, and it is
 * the one password the account holder did not pick and may never change.
 *
 * `crypto.getRandomValues`, never `Math.random`: this is a credential.
 */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSWORD_LENGTH = 16; // The API's floor is 12.

function mintPassword(): string {
  const bytes = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]).join('');
}

/** A created account, and the credential to read out before the dialog closes. */
export interface CreatedConsoleUser extends MutationAck {
  password: string;
}

export const userRepository = {
  /**
   * **Filtered and paged here, because the API does neither** (gap **G-09**).
   *
   * `GET /admin/users` answers with every console user of the factory in one array. For a
   * dozen office staff that is the right call — a pager over twelve rows is furniture, and
   * a round trip per keystroke is worse than a filter over an array already in memory.
   * It stops being the right call at a scale a tea factory's office will not reach.
   */
  list: async (query: UserQuery = {}): Promise<Paged<AdminConsoleUser>> => {
    const all = await userEndpoints.list();
    const needle = query.q?.trim().toLowerCase();

    const matching = all.filter((user) => {
      if (query.status && user.status !== query.status) return false;
      if (query.role && !user.roles.includes(query.role)) return false;
      if (!needle) return true;
      return (
        user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
      );
    });

    return paginate(matching, { page: query.page ?? 0, pageSize: query.pageSize ?? 50 });
  },

  /**
   * Create an account and return the credential **once**.
   *
   * The response is not the user record — the API acknowledges with `{ id }` and the list
   * is refetched — but it does carry the password, because this is the only moment it
   * exists anywhere readable.
   */
  create: async (body: ConsoleUserDraft): Promise<CreatedConsoleUser> => {
    const password = mintPassword();
    const { id } = await userEndpoints.create({ ...body, password });
    return { id, password };
  },

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
  ): Promise<MutationAck> => {
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
  ): Promise<StatusAck<'active' | 'suspended'>> => {
    if (id === context.actingUserId) throw selfModification('suspend');

    const target = context.all.find((one) => one.id === id);
    if (target) {
      const next: LockoutCandidate = { ...target, status: 'suspended' };
      const others = context.all.filter((one) => one.id !== id);
      if (wouldLockOut(next, others)) throw lockout({ userId: id });
    }

    return userEndpoints.setStatus(id, 'suspended', requireReason(reason));
  },

  reactivate: async (id: string, reason: string): Promise<StatusAck<'active' | 'suspended'>> =>
    userEndpoints.setStatus(id, 'active', requireReason(reason)),

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
  ): Promise<MutationAck> => {
    const proposed = { ...currentMatrix, [role]: grants };
    if (!matrixKeepsRecovery(proposed)) {
      throw lockout({ role, reason: 'no role would grant usersAndRoles' });
    }
    return userEndpoints.setRole(role, grants);
  },
};
