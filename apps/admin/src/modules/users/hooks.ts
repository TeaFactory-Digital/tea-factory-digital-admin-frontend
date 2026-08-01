/**
 * M15 queries and mutations.
 *
 * The unusual thing here is that most mutations need **the whole user list**, not just the
 * record being changed. "Is this the last administrator" is not a property of one row, so the
 * lockout guard in `userRepository` takes the set — and these hooks thread it through from the
 * list the screen is already holding rather than refetching it.
 *
 * Editing a role's grants invalidates the **session**, and that is the one invalidation worth
 * spelling out: `resolveGrants` merges the server's grants over the shipped matrix, so a role
 * change alters what the signed-in user may do. Without it, an administrator who has just
 * narrowed their own role would keep seeing every button until they reloaded.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccessLevel,
  Capability,
  ConsoleRole,
  ConsoleUserDraft,
  ConsoleUserPatch,
  LockoutCandidate,
  UserQuery,
} from '@tfd/domain';
import { userRepository } from '@/services/repositories/userRepository';
import { useAuthStore } from '@/auth/authStore';
import { qk } from '@/query/queryKeys';

export function useUsers(query: UserQuery) {
  return useQuery({
    queryKey: qk.users.list(query),
    queryFn: () => userRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useRoleMatrix() {
  return useQuery({
    queryKey: qk.users.roles,
    queryFn: () => userRepository.roles(),
  });
}

function useInvalidateUsers() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.users.all });
    void client.invalidateQueries({ queryKey: qk.audit.all });
    /**
     * The signed-in session's own grants.
     *
     * `resolveGrants` merges what the server sends over the shipped matrix, so changing a
     * role changes what the current user may do. An administrator who narrowed their own
     * role and kept seeing every button would be looking at a console that disagrees with
     * the server about what they can do.
     */
    void client.invalidateQueries({ queryKey: qk.session.me });
  };
}

/** The context every lockout guard needs: the whole set, and who is acting. */
export function useLockoutContext(users: readonly LockoutCandidate[]) {
  const actingUserId = useAuthStore((s) => s.user?.id);
  return { all: users, actingUserId };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (body: ConsoleUserDraft) => userRepository.create(body),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({
      id,
      body,
      context,
    }: {
      id: string;
      body: ConsoleUserPatch;
      context: { all: readonly LockoutCandidate[]; actingUserId: string | undefined };
    }) => userRepository.patch(id, body, context),
    onSuccess: invalidate,
  });
}

export type UserAction = 'suspend' | 'reactivate' | 'mfa';

/**
 * Suspend, reactivate and reset-MFA behind one mutation.
 *
 * All three take a mandatory reason and invalidate the same things, so three hooks would be
 * three places to forget the session key. Which action is *offered* is the screen's decision;
 * the server refuses the rest.
 */
export function useUserAction() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
      context,
    }: {
      id: string;
      action: UserAction;
      reason: string;
      context: { all: readonly LockoutCandidate[]; actingUserId: string | undefined };
    }) =>
      action === 'suspend'
        ? userRepository.suspend(id, reason, context)
        : action === 'reactivate'
          ? userRepository.reactivate(id, reason)
          : userRepository.resetMfa(id, reason, { actingUserId: context.actingUserId }),
    onSuccess: invalidate,
  });
}

export function useSetRoleGrants() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({
      role,
      grants,
      currentMatrix,
    }: {
      role: ConsoleRole;
      grants: Record<Capability, AccessLevel>;
      currentMatrix: Record<ConsoleRole, Record<Capability, AccessLevel>>;
    }) => userRepository.setRole(role, grants, currentMatrix),
    onSuccess: invalidate,
  });
}
