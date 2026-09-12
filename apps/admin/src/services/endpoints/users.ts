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
  RoleMatrix,
  AccessLevel,
  Capability,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import type { MutationAck, StatusAck } from '../api/adapters';


export const userEndpoints = {
  /**
   * **Unpaged, and the query is ignored.**
   *
   * The API answers with every console user of this factory as a bare array — no
   * envelope, no `total`, no filtering (gap **G-09**). That is defensible for this
   * resource in a way it would not be for suppliers: a tea factory's office has a dozen
   * staff, not a dozen thousand, and paging twelve rows is furniture. `userRepository`
   * puts the envelope back and filters locally so the screen does not have to know.
   */
  list: () => apiClient.get<AdminConsoleUser[]>('/admin/users').then((response) => response.data),

  /**
   * `409 email-taken` — the address is the identity, and two of them is two people.
   *
   * **The API requires a `password`** and the domain's `ConsoleUserDraft` has no field
   * for one (gap **G-02**): there is no invitation flow, so somebody's first credential
   * is set by whoever creates the account. `userRepository` mints one rather than letting
   * a dialog invent the policy.
   */
  create: (body: ConsoleUserDraft & { password: string }) =>
    apiClient.post<MutationAck>('/admin/users', body).then((response) => response.data),

  /**
   * Name and roles. **Not email**, which is the identity a session is issued against —
   * changing it would be creating a different person while keeping their audit trail.
   *
   * `409 last-admin` · `409 self-modification` when the change is to your own roles.
   */
  patch: (id: string, body: ConsoleUserPatch) =>
    apiClient.patch<MutationAck>(`/admin/users/${id}`, body).then((response) => response.data),

  /**
   * Suspend and reactivate — **one endpoint**, as with suppliers, because they are one
   * state machine and only one place should decide what transitions are legal.
   *
   * `422 note-required` — a suspended colleague will ask why, like a supplier does; the
   * API's floor is 10 characters and `userRepository` refuses shorter before the request
   * leaves, so the clerk is stopped at the field rather than after the round trip.
   */
  setStatus: (id: string, status: 'active' | 'suspended', reason: string) =>
    apiClient
      .post<StatusAck<'active' | 'suspended'>>(`/admin/users/${id}/status`, { status, reason })
      .then((response) => response.data),

  /**
   * The §12.1 matrix as served — the authority, of which `rbac.ts` is the default.
   *
   * Carries `updatedByName` — **G-10 is closed**, so the "last changed by" caption has a
   * name in it rather than the `null` this layer used to fill in.
   */
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
      .put<MutationAck>(`/admin/roles/${role}`, { grants })
      .then((response) => response.data),
};
