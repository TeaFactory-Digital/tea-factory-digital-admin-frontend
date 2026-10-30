/**
 * Who decides a credit request, by amount (Q6, 30 October 2026): a clerk up to the
 * factory's limit, the manager in between, the owner (factory administrator) above the
 * owner threshold. With neither set, the manager, as before.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CREDIT_RULES, approvalTierFor, canDecideCredit, creditRuleProblems, grantsFromRoles } from '@tfd/domain';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { creditRepository } from '@/services/repositories/creditRepository';
import { signInAs, signOut } from './render';
import { eligibilityOf } from './credit';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const NOTE = 'Checked against the leaf already weighed this month at the counter.';
const ADVANCE = 'crd-1';

describe('the rule', () => {
  const rule = { clerkApprovesUpTo: 5000, ownerApprovesAbove: 100_000 };

  it('sends each amount to its tier', () => {
    expect(approvalTierFor(5000, rule)).toBe('clerk');
    expect(approvalTierFor(5000.01, rule)).toBe('manager');
    expect(approvalTierFor(100_000, rule)).toBe('manager');
    expect(approvalTierFor(100_001, rule)).toBe('owner');
    expect(approvalTierFor(1_000_000, {})).toBe('manager');
  });

  it('gives each tier to its role by default', () => {
    const [clerk, manager, owner] = (['clerk', 'manager', 'factoryAdmin'] as const).map((role) => grantsFromRoles([role]));
    expect(canDecideCredit(clerk, 'clerk')).toBe(true);
    expect(canDecideCredit(clerk, 'manager')).toBe(false);
    expect(canDecideCredit(manager, 'manager')).toBe(true);
    expect(canDecideCredit(manager, 'owner')).toBe(false);
    expect(canDecideCredit(owner, 'owner')).toBe(true);
  });

  it('refuses limits that contradict each other', () => {
    expect(creditRuleProblems({ ...DEFAULT_CREDIT_RULES.advance, clerkApprovesUpTo: 10_000, ownerApprovesAbove: 5000 })).toContain(
      'bad-approval-limits',
    );
  });
});

describe('deciding', () => {
  async function setLimits(clerkApprovesUpTo: number | null, ownerApprovesAbove: number | null) {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    const rules = config.creditRules ?? DEFAULT_CREDIT_RULES;
    await adminConfigRepository.patch(
      { creditRules: { ...rules, advance: { ...rules.advance, clerkApprovesUpTo, ownerApprovesAbove } } },
      config,
      usage,
    );
  }

  async function approve() {
    const request = await creditRepository.get(ADVANCE);
    return creditRepository.approve(
      ADVANCE,
      { note: NOTE, ceilingSeen: eligibilityOf(request).ceiling },
      { amount: request.amount, available: eligibilityOf(request).available },
    );
  }

  beforeEach(() => signOut());
  afterEach(() => signOut());

  it('lets the clerk approve an advance under the clerk limit', async () => {
    await setLimits(1_000_000, null);
    await signInAs(CLERK);
    expect((await approve()).status).toBe('approved');
  }, 20_000);

  it('sends an advance above the owner threshold to the owner, not the manager', async () => {
    await setLimits(null, 1);
    await signInAs(MANAGER);
    await expect(approve()).rejects.toMatchObject({ code: 'approval-above-limit', details: { needs: 'owner' } });
    await signInAs(ADMIN);
    expect((await approve()).status).toBe('approved');
  }, 20_000);
});
