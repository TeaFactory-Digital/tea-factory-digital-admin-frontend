/**
 * M15 Users & roles — the module that can break every other one at once.
 *
 * rbac.md: §12.1 is *"data, not code: a factory will want to split or merge these roles, and
 * that must not be a deploy."* These endpoints are that promise made operable, and every
 * refusal below is a version of the same failure: **a factory locking itself out of its own
 * console.**
 *
 *  - `last-admin` — suspending or demoting the only person who can administer users. Also
 *    raised by a matrix edit that leaves no *role* granting it, which is the version nobody
 *    thinks of because not one user record changes.
 *  - `self-modification` — doing it to yourself, refused even when somebody else remains.
 *    It is never what was meant, and the person it strands is the one mid-task.
 *
 * There is **no delete**. A user who has approved a payout or published a month is the actor
 * on an audit entry, and an entry whose actor cannot be resolved is not evidence. They are
 * suspended, which is the same rule that voids a delivery rather than removing it (§12.1).
 */

import type {
  AdminConsoleUser,
  ConsoleRole,
  ConsoleUserDraft,
  ConsoleUserPatch,
  Paged,
  RoleMatrix,
  UserQuery,
  AccessLevel,
  Capability,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const userEndpoints = {
  list: (query: UserQuery = {}) =>
    apiClient
      .get<Paged<AdminConsoleUser>>('/admin/users', { params: toParams(query) })
      .then((response) => response.data),

  /** `409 email-taken` — the address is the identity, and two of them is two people. */
  create: (body: ConsoleUserDraft) =>
    apiClient.post<AdminConsoleUser>('/admin/users', body).then((response) => response.data),

  /**
   * Name and roles. **Not email**, which is the identity a session is issued against —
   * changing it would be creating a different person while keeping their audit trail.
   *
   * `409 last-admin` · `409 self-modification` when the change is to your own roles.
   */
  patch: (id: string, body: ConsoleUserPatch) =>
    apiClient.patch<AdminConsoleUser>(`/admin/users/${id}`, body).then((response) => response.data),

  /** `422 note-required` — a suspended colleague will ask why, like a supplier does. */
  suspend: (id: string, reason: string) =>
    apiClient
      .post<AdminConsoleUser>(`/admin/users/${id}/suspend`, { reason })
      .then((response) => response.data),

  reactivate: (id: string, reason: string) =>
    apiClient
      .post<AdminConsoleUser>(`/admin/users/${id}/reactivate`, { reason })
      .then((response) => response.data),

  /**
   * Clear an enrolled second factor so the user enrols again on next sign-in.
   *
   * The one action here that is a **security** operation rather than an administrative one:
   * it is what the office does when somebody loses their phone, and it is also exactly what
   * an attacker with an administrator session would do. Audited by name, and refused on
   * yourself — resetting your own is not recovery, it is a way to drop your own second
   * factor while holding a live session.
   */
  resetMfa: (id: string, reason: string) =>
    apiClient
      .post<AdminConsoleUser>(`/admin/users/${id}/mfa/reset`, { reason })
      .then((response) => response.data),

  /** The §12.1 matrix as served — the authority, of which `rbac.ts` is the default. */
  roles: () => apiClient.get<RoleMatrix>('/admin/roles').then((response) => response.data),

  /**
   * Edit one role's grants.
   *
   * `409 last-admin` when the result would leave no role granting `usersAndRoles: write` —
   * the lockout that changes no user record at all. `422 unknown-role` for a role outside
   * §12.1, because a grant nothing can hold is a permission nobody has.
   */
  setRole: (role: ConsoleRole, grants: Record<Capability, AccessLevel>) =>
    apiClient
      .put<RoleMatrix>(`/admin/roles/${role}`, { grants })
      .then((response) => response.data),
};
