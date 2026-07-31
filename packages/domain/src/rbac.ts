/**
 * The §12.1 permission matrix, **as data**.
 *
 * domain-logic.md is explicit that this is "data, not code: a factory will want
 * to split or merge these roles, and that must not be a deploy". So the table
 * below is the *offline default* — the shape the platform ships with. The
 * authoritative grants come from the server on `GET /admin/auth/me`, and
 * `resolveGrants` merges them.
 *
 * Two things this module deliberately does **not** do:
 *
 *  - **It does not authorize anything.** Permissions are enforced server-side
 *    per endpoint (admin-console.md → Auth and roles); hiding a button is a
 *    courtesy so a clerk is not shown a lever that will 403.
 *  - **It does not decide four-eyes.** `isSelfApproval` is a UI pre-check; the
 *    server must refuse with `four-eyes-violation` regardless (BR-501),
 *    because the console can be lied to about who created a record.
 */

import type {
  AccessLevel,
  Capability,
  CapabilityGrants,
  ConsoleRole,
  ConsoleUser,
} from './types/admin';

const NONE: AccessLevel = 'none';
const R: AccessLevel = 'read';
const W: AccessLevel = 'write';
const A: AccessLevel = 'approve';

/**
 * Ordered weakest→strongest. `write` implies `read`, and `approve` implies both
 * — an approver who could not read the record could not approve responsibly.
 */
const ACCESS_ORDER: AccessLevel[] = ['none', 'read', 'write', 'approve'];

const rank = (level: AccessLevel): number => ACCESS_ORDER.indexOf(level);

/** Transcribed row for row from the §12.1 table. */
export const DEFAULT_ROLE_MATRIX: Record<ConsoleRole, Record<Capability, AccessLevel>> = {
  clerk: {
    suppliers: W,
    deliveries: R,
    ratesAndMonthClose: NONE,
    billing: R,
    payouts: R,
    creditRequests: R,
    creditAboveThreshold: NONE,
    changeRequests: A,
    inquiries: A,
    content: R,
    flagsAndBranding: R,
    usersAndRoles: NONE,
    reports: R,
    auditLog: NONE,
    tenants: NONE,
  },
  weigher: {
    suppliers: R,
    deliveries: W,
    ratesAndMonthClose: NONE,
    billing: NONE,
    payouts: NONE,
    creditRequests: NONE,
    creditAboveThreshold: NONE,
    changeRequests: NONE,
    inquiries: NONE,
    content: NONE,
    flagsAndBranding: NONE,
    usersAndRoles: NONE,
    reports: R,
    auditLog: NONE,
    tenants: NONE,
  },
  accountant: {
    suppliers: R,
    deliveries: W,
    ratesAndMonthClose: W,
    billing: W,
    payouts: W,
    creditRequests: R,
    creditAboveThreshold: NONE,
    changeRequests: R,
    inquiries: NONE,
    content: NONE,
    flagsAndBranding: NONE,
    usersAndRoles: NONE,
    reports: R,
    auditLog: R,
    tenants: NONE,
  },
  manager: {
    suppliers: R,
    deliveries: R,
    ratesAndMonthClose: A,
    billing: A,
    payouts: A,
    creditRequests: A,
    creditAboveThreshold: A,
    changeRequests: A,
    inquiries: R,
    content: R,
    flagsAndBranding: R,
    usersAndRoles: R,
    reports: R,
    auditLog: R,
    tenants: NONE,
  },
  editor: {
    suppliers: NONE,
    deliveries: NONE,
    ratesAndMonthClose: NONE,
    billing: NONE,
    payouts: NONE,
    creditRequests: NONE,
    creditAboveThreshold: NONE,
    changeRequests: NONE,
    inquiries: NONE,
    content: W,
    flagsAndBranding: NONE,
    usersAndRoles: NONE,
    reports: NONE,
    auditLog: NONE,
    tenants: NONE,
  },
  factoryAdmin: {
    suppliers: R,
    deliveries: NONE,
    ratesAndMonthClose: NONE,
    billing: NONE,
    payouts: NONE,
    creditRequests: NONE,
    creditAboveThreshold: NONE,
    changeRequests: NONE,
    inquiries: NONE,
    content: A,
    flagsAndBranding: W,
    usersAndRoles: W,
    reports: R,
    auditLog: R,
    tenants: NONE,
  },
  platformAdmin: {
    suppliers: R,
    deliveries: NONE,
    ratesAndMonthClose: NONE,
    billing: NONE,
    payouts: NONE,
    creditRequests: NONE,
    creditAboveThreshold: NONE,
    changeRequests: NONE,
    inquiries: NONE,
    content: NONE,
    flagsAndBranding: W,
    usersAndRoles: W,
    reports: R,
    auditLog: R,
    tenants: W,
  },
};

/** Highest level any of the user's roles grants for a capability. */
export function grantsFromRoles(roles: ConsoleRole[]): CapabilityGrants {
  const out: CapabilityGrants = {};
  for (const role of roles) {
    const row = DEFAULT_ROLE_MATRIX[role];
    if (!row) continue;
    for (const key of Object.keys(row) as Capability[]) {
      const level = row[key];
      const current = out[key] ?? NONE;
      if (rank(level) > rank(current)) out[key] = level;
    }
  }
  return out;
}

/**
 * Server grants win where present; the role matrix fills the gaps.
 *
 * The asymmetry is on purpose. A server that has been reconfigured to split
 * "clerk" into two roles sends grants this build has never heard of, and those
 * must be honoured. A server that sends nothing for a capability has not
 * revoked it — it has said nothing, and the shipped default applies.
 */
export function resolveGrants(
  roles: ConsoleRole[],
  serverGrants?: CapabilityGrants,
): CapabilityGrants {
  const base = grantsFromRoles(roles);
  if (!serverGrants) return base;
  return { ...base, ...serverGrants };
}

/** Does this grant set reach `required` on `capability`? */
export function can(
  grants: CapabilityGrants | undefined,
  capability: Capability,
  required: Exclude<AccessLevel, 'none'> = 'read',
): boolean {
  if (!grants) return false;
  return rank(grants[capability] ?? NONE) >= rank(required);
}

/**
 * Four eyes on money (BR-501): whoever created a record may not approve it.
 *
 * `createdById === null` means the supplier raised it from the app, which is
 * the common case for a change request and is never a violation.
 */
export function isSelfApproval(
  user: Pick<ConsoleUser, 'id'> | null | undefined,
  createdById: string | null | undefined,
): boolean {
  if (!user || !createdById) return false;
  return user.id === createdById;
}

/**
 * Above the manager's threshold, approval **escalates rather than widens** — a
 * second clerk is not a substitute for a manager (§12.1).
 *
 * The threshold itself is tenant policy and still unanswered (status.md §21.6),
 * so it is a parameter here rather than a constant. Pass `null` while the
 * factory has not set one; the function then requires only the base capability.
 */
export function canApproveAmount(
  grants: CapabilityGrants | undefined,
  amount: number,
  managerThreshold: number | null,
): boolean {
  if (!can(grants, 'creditRequests', 'approve')) return false;
  if (managerThreshold === null || amount <= managerThreshold) return true;
  return can(grants, 'creditAboveThreshold', 'approve');
}
