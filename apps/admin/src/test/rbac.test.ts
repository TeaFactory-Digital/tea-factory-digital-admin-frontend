/**
 * The §12.1 permission matrix, as tests.
 *
 * These are the highest-value unit tests in the console: the matrix is the thing
 * a factory will ask to change, and every change is a chance to hand a clerk an
 * approval they should not have.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_MATRIX,
  can,
  canApproveAmount,
  grantsFromRoles,
  isSelfApproval,
  resolveGrants,
} from '@tfd/domain';

describe('grantsFromRoles', () => {
  it('gives a clerk approval on change requests and inquiries only', () => {
    const grants = grantsFromRoles(['clerk']);
    expect(can(grants, 'changeRequests', 'approve')).toBe(true);
    expect(can(grants, 'inquiries', 'approve')).toBe(true);
    expect(can(grants, 'ratesAndMonthClose', 'read')).toBe(false);
    expect(can(grants, 'creditAboveThreshold', 'approve')).toBe(false);
  });

  it('does not let a manager edit supplier records', () => {
    // §12.1 gives the manager `R` on supplier records, not `W`. Easy to get
    // wrong, because a manager outranks a clerk everywhere else.
    const grants = grantsFromRoles(['manager']);
    expect(can(grants, 'suppliers', 'read')).toBe(true);
    expect(can(grants, 'suppliers', 'write')).toBe(false);
  });

  it('takes the strongest level across several roles', () => {
    const grants = grantsFromRoles(['weigher', 'accountant']);
    expect(can(grants, 'deliveries', 'write')).toBe(true);
    expect(can(grants, 'ratesAndMonthClose', 'write')).toBe(true);
  });

  it('treats approve as implying write and read', () => {
    const grants = grantsFromRoles(['manager']);
    expect(can(grants, 'billing', 'approve')).toBe(true);
    expect(can(grants, 'billing', 'write')).toBe(true);
    expect(can(grants, 'billing', 'read')).toBe(true);
  });

  it('gives an editor content and nothing else', () => {
    const grants = grantsFromRoles(['editor']);
    expect(can(grants, 'content', 'write')).toBe(true);
    for (const capability of Object.keys(DEFAULT_ROLE_MATRIX.editor) as Array<
      keyof typeof DEFAULT_ROLE_MATRIX.editor
    >) {
      if (capability === 'content') continue;
      expect(can(grants, capability, 'read')).toBe(false);
    }
  });

  it('gives only a platform admin tenant access', () => {
    expect(can(grantsFromRoles(['platformAdmin']), 'tenants', 'write')).toBe(true);
    expect(can(grantsFromRoles(['factoryAdmin']), 'tenants', 'read')).toBe(false);
    expect(can(grantsFromRoles(['manager']), 'tenants', 'read')).toBe(false);
  });
});

describe('resolveGrants', () => {
  it('lets the server override the shipped matrix', () => {
    // "Roles are data, not code": a factory that splits `clerk` in two sends
    // grants this build has never heard of, and they must win.
    const grants = resolveGrants(['clerk'], { changeRequests: 'read' });
    expect(can(grants, 'changeRequests', 'approve')).toBe(false);
    expect(can(grants, 'changeRequests', 'read')).toBe(true);
  });

  it('falls back to the matrix for capabilities the server omits', () => {
    const grants = resolveGrants(['clerk'], { changeRequests: 'read' });
    expect(can(grants, 'suppliers', 'write')).toBe(true);
  });

  it('works with no server grants at all', () => {
    const grants = resolveGrants(['accountant']);
    expect(can(grants, 'ratesAndMonthClose', 'write')).toBe(true);
  });
});

describe('isSelfApproval (BR-501)', () => {
  const user = { id: 'usr-clerk-1' };

  it('is a violation when the approver created the record', () => {
    expect(isSelfApproval(user, 'usr-clerk-1')).toBe(true);
  });

  it('is not a violation when someone else created it', () => {
    expect(isSelfApproval(user, 'usr-manager-1')).toBe(false);
  });

  it('is never a violation for a supplier-raised request', () => {
    // `createdById: null` means the app raised it — the common case, and it must
    // not lock the whole queue.
    expect(isSelfApproval(user, null)).toBe(false);
  });
});

describe('canApproveAmount (§21.6)', () => {
  const clerk = grantsFromRoles(['clerk']);
  const manager = grantsFromRoles(['manager']);

  it('refuses a clerk with no credit approval regardless of amount', () => {
    expect(canApproveAmount(clerk, 100, 50_000)).toBe(false);
  });

  it('lets a manager approve below and above the threshold', () => {
    expect(canApproveAmount(manager, 10_000, 50_000)).toBe(true);
    expect(canApproveAmount(manager, 90_000, 50_000)).toBe(true);
  });

  it('requires only the base capability while the factory has set no threshold', () => {
    // The threshold is still an open question, so `null` must not block every
    // approval — it means "not configured", not "nothing is allowed".
    expect(canApproveAmount(manager, 1_000_000, null)).toBe(true);
  });
});
