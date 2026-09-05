/**
 * The factory's own lending rules — **configuration, not code.**
 *
 * The three ceilings used to be formulas in the build with two constants behind them.
 * A factory wanting *"manure: average the last three months, capped at 20,000"* needed
 * a release, which is exactly what white-label.md says a `client_config` row is for.
 *
 * Two properties are asserted here and both matter more than the arithmetic:
 *
 *  1. **The defaults reproduce the old behaviour exactly.** A factory that never opens
 *     the screen must not discover its lending quietly moved the day this shipped.
 *  2. **One rule feeds both readers.** The ceiling the app shows a supplier and the
 *     ceiling the credit queue checks come from the same configured numbers — which is
 *     AC-05 restated for a rule the factory now owns.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CREDIT_RULES,
  advanceCeiling,
  buildCreditEligibility,
  configImpact,
  creditCeiling,
  creditCeilingFromRule,
  creditRuleProblems,
  installmentOptionsFor,
  loanCeiling,
  manureCeiling,
  type CreditRule,
  type GreenLeafBill,
} from '@tfd/domain';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { creditRepository } from '@/services/repositories/creditRepository';
import { signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const FACTORY_ADMIN = 'factoryadmin@galabodatea.lk';

const AT = '2026-08-08T00:00:00.000Z';

/** A settled month: a rate is in, so it counts towards history and averages. */
function settled(monthKey: string, kgs: number, gross: number): GreenLeafBill {
  return {
    monthKey,
    year: Number(monthKey.slice(0, 4)),
    auctionResultAvailable: true,
    totalKgs: kgs,
    totalRatePerKg: 100,
    grossAmount: gross,
  } as unknown as GreenLeafBill;
}

/** The month in progress: no rate yet, so it never counts towards history. */
function open(monthKey: string, kgs: number): GreenLeafBill {
  return {
    monthKey,
    year: Number(monthKey.slice(0, 4)),
    auctionResultAvailable: false,
    totalKgs: kgs,
    totalRatePerKg: null,
    grossAmount: null,
  } as unknown as GreenLeafBill;
}

/** Six settled months at a steady 30,000, plus an open month with 200 kg in it. */
const BILLS: GreenLeafBill[] = [
  settled('2026-01', 300, 30000),
  settled('2026-02', 300, 30000),
  settled('2026-03', 300, 30000),
  settled('2026-04', 300, 30000),
  settled('2026-05', 300, 30000),
  settled('2026-06', 300, 30000),
  open('2026-07', 200),
];

describe('the configured rule drives the ceiling', () => {
  it('reproduces the hard-coded formulas exactly, by default', () => {
    /**
     * The property that makes this feature safe to ship. If the defaults differed from
     * the formulas by a cent, every factory's lending would move on deploy day and
     * nobody would be told.
     */
    for (const facility of ['advance', 'loan', 'manure'] as const) {
      expect(creditCeilingFromRule(DEFAULT_CREDIT_RULES[facility], BILLS)).toBe(
        creditCeiling(facility, BILLS),
      );
    }

    // Spelled out again against the individual functions, so a change to
    // `creditCeiling`'s dispatch cannot make the assertion above vacuously true.
    expect(creditCeilingFromRule(DEFAULT_CREDIT_RULES.advance, BILLS)).toBe(advanceCeiling(BILLS));
    expect(creditCeilingFromRule(DEFAULT_CREDIT_RULES.loan, BILLS)).toBe(loanCeiling(BILLS));
    expect(creditCeilingFromRule(DEFAULT_CREDIT_RULES.manure, BILLS)).toBe(manureCeiling(BILLS));
  });

  it('honours the example this feature was built for: 3 months ÷ 3, capped at 20,000', () => {
    // "for manure, last 3 months / 3 — 20,000": average the last three settled months,
    // take it once, and never allow more than twenty thousand.
    const rule: CreditRule = {
      requiredMonths: 3,
      basis: 'averageIncome',
      averageOverMonths: 3,
      multiplier: 1,
      maxAmount: 20000,
    };

    // The average is 30,000 — above the cap, so the cap is what a supplier is offered.
    expect(creditCeilingFromRule(rule, BILLS)).toBe(20000);
  });

  it('applies the cap after the multiplier, not before', () => {
    const uncapped: CreditRule = {
      requiredMonths: 0,
      basis: 'averageIncome',
      averageOverMonths: 6,
      multiplier: 3,
      maxAmount: null,
    };
    expect(creditCeilingFromRule(uncapped, BILLS)).toBe(90000);

    /**
     * The order the office states it in: *"three times the average, but never more
     * than fifty thousand"*. Capping the basis first would give 3 × 50,000 = 150,000 —
     * the opposite of what was asked for, and higher rather than lower.
     */
    expect(creditCeilingFromRule({ ...uncapped, maxAmount: 50000 }, BILLS)).toBe(50000);
  });

  it('offers nothing below the history requirement, whatever the basis would give', () => {
    const short = [settled('2026-05', 300, 30000), open('2026-06', 200)];

    const rule: CreditRule = {
      requiredMonths: 6,
      basis: 'averageIncome',
      averageOverMonths: 6,
      multiplier: 3,
      maxAmount: null,
    };
    expect(creditCeilingFromRule(rule, short)).toBe(0);

    /**
     * `requiredMonths: 0` is what lets a supplier in their **first** month have an
     * advance and nothing else — the case the gate exists to permit rather than to
     * refuse. Asserted with the advance basis, because that is the facility it is for:
     * an income average over six months is still zero for a supplier who has one, and
     * deliberately so (`averageMonthlyIncome` fails closed rather than averaging a
     * partial window).
     */
    const advanceRule: CreditRule = { ...rule, requiredMonths: 0, basis: 'thisMonthLeaf' };
    expect(creditCeilingFromRule(advanceRule, short)).toBeGreaterThan(0);
  });

  it('refuses to average a partial window, rather than lending against it', () => {
    const short = [settled('2026-05', 300, 30000), open('2026-06', 200)];

    /**
     * One settled month asked to stand in for six. The average **fails closed** at
     * zero rather than dividing what it has — a partial average is a bigger number
     * than the rule intends, and this is a ceiling.
     */
    const rule: CreditRule = {
      requiredMonths: 0,
      basis: 'averageIncome',
      averageOverMonths: 6,
      multiplier: 1,
      maxAmount: null,
    };
    expect(creditCeilingFromRule(rule, short)).toBe(0);

    // Asked for what it actually has, it answers.
    expect(creditCeilingFromRule({ ...rule, averageOverMonths: 1 }, short)).toBe(30000);
  });

  it('prints the working from the configured rule, not from the old constants', () => {
    const rule: CreditRule = {
      requiredMonths: 3,
      basis: 'averageIncome',
      averageOverMonths: 3,
      multiplier: 2,
      maxAmount: null,
    };

    const eligibility = buildCreditEligibility({
      facility: 'manure',
      bills: BILLS,
      outstanding: 0,
      computedAt: AT,
      rule,
    });

    /**
     * AC-05 says the console must show the working, not just the answer. Under a
     * configured rule the working has to be the **rule's** numbers — a ceiling from
     * the rule beside a "required months" from the old constant would print a refusal
     * that the ceiling next to it contradicts.
     */
    expect(eligibility.ceiling).toBe(60000);
    expect(eligibility.requiredMonths).toBe(3);
    expect(eligibility.limitMultiplier).toBe(2);
    expect(eligibility.averageMonthlyIncome).toBe(30000);
  });

  it('subtracts what is already drawn, and floors at zero', () => {
    const rule = DEFAULT_CREDIT_RULES.loan;
    const eligibility = buildCreditEligibility({
      facility: 'loan',
      bills: BILLS,
      outstanding: 999999,
      computedAt: AT,
      rule,
    });

    expect(eligibility.available).toBe(0);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasonKey).toBe('credit.reason.fullyDrawn');
  });
});

describe('creditRuleProblems', () => {
  const ok: CreditRule = {
    requiredMonths: 3,
    basis: 'averageIncome',
    averageOverMonths: 3,
    multiplier: 1,
    maxAmount: 20000,
  };

  it('accepts a usable rule', () => {
    expect(creditRuleProblems(ok)).toEqual([]);
    // No cap is a state, not a missing figure.
    expect(creditRuleProblems({ ...ok, maxAmount: null })).toEqual([]);
  });

  it('refuses the values that fail silently', () => {
    // Divides by zero on the next request that reads it.
    expect(creditRuleProblems({ ...ok, averageOverMonths: 0 })).toContain('bad-average-months');
    /**
     * A multiplier of zero offers every supplier a ceiling of nothing and reads on
     * screen as a policy rather than a mistake. Turning the facility off is what
     * "nobody may borrow" is for.
     */
    expect(creditRuleProblems({ ...ok, multiplier: 0 })).toContain('negative-multiplier');
    expect(creditRuleProblems({ ...ok, maxAmount: 0 })).toContain('negative-max');
    expect(creditRuleProblems({ ...ok, requiredMonths: -1 })).toContain('negative-months');
  });

  it('blocks a bad rule through the same configImpact M14 refuses with', () => {
    const impacts = configImpact(
      { creditRules: { ...DEFAULT_CREDIT_RULES, loan: { ...ok, multiplier: 0 } } },
      {
        flags: {} as never,
        collectionPoints: [],
        banks: [],
        contentLanguages: ['en'],
      },
      {
        savingsBalances: 0,
        openPayoutRuns: 0,
        outstandingCredit: { advance: 0, loan: 0, manure: 0 },
        teaPacketsOutstanding: 0,
        deliveriesByPoint: {},
        suppliersByBank: {},
        contentByLanguage: {},
      },
    );

    // A ceiling is the figure a supplier is told they may borrow, so it blocks the
    // save rather than warning about it — the same line the payout template draws.
    expect(impacts.some((one) => one.severity === 'blocks')).toBe(true);
    expect(impacts.some((one) => one.field === 'creditRules.loan')).toBe(true);
  });
});

/**
 * Repayment terms — **the last piece of credit policy that lived in two places.**
 *
 * The app's instalment picker read a constant compiled into the mobile bundle; the API
 * validated the chosen term against its own list. Two lists that agree right up until one
 * of them is edited, and the failure lands on a supplier: a term the picker offered and
 * the factory then refused. These assert the single-source property, not the numbers.
 */
describe('installment terms come off the rule', () => {
  it('defaults to exactly what the app hard-coded before', () => {
    // Moved, not changed. A factory that has set no policy offers what it always did.
    expect(installmentOptionsFor(DEFAULT_CREDIT_RULES, 'loan')).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(installmentOptionsFor(DEFAULT_CREDIT_RULES, 'manure')).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('offers no term for an advance, which has none to offer', () => {
    /**
     * Not an oversight and not an empty list to be filled in later: an advance is settled
     * out of the next month's leaf in one go. Empty is the correct answer, and it is what
     * keeps the picker off the advance screen.
     */
    expect(installmentOptionsFor(DEFAULT_CREDIT_RULES, 'advance')).toEqual([]);
  });

  it('falls back to the platform list when the factory has set none', () => {
    // `undefined` is the ordinary state of a `client_config` row written before this
    // field existed — reading `rule.installmentOptions` directly is what breaks it.
    const rules = {
      ...DEFAULT_CREDIT_RULES,
      loan: { ...DEFAULT_CREDIT_RULES.loan, installmentOptions: undefined },
    };
    expect(installmentOptionsFor(rules, 'loan')).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('reads the factory’s list when it has set one', () => {
    const rules = {
      ...DEFAULT_CREDIT_RULES,
      manure: { ...DEFAULT_CREDIT_RULES.manure, installmentOptions: [2, 4] },
    };
    expect(installmentOptionsFor(rules, 'manure')).toEqual([2, 4]);
  });

  it('refuses the lists that would break the picker', () => {
    const base = DEFAULT_CREDIT_RULES.loan;
    const problems = (installmentOptions: number[]) =>
      creditRuleProblems({ ...base, installmentOptions });

    /**
     * Empty is the one worth stating. It is not "this facility is off" — the app renders
     * a picker with no chip and a form that cannot be submitted, which reads on a phone
     * as a broken screen. Switching the facility off under Features is what off is for.
     */
    expect(problems([])).toContain('bad-installments');
    expect(problems([0, 3])).toContain('bad-installments');
    expect(problems([-1])).toContain('bad-installments');
    expect(problems([1.5, 3])).toContain('bad-installments');
    // Out of order and repeated both fail, because the app renders them as they arrive.
    expect(problems([6, 3])).toContain('bad-installments');
    expect(problems([3, 3, 6])).toContain('bad-installments');

    expect(problems([1, 2, 3])).toEqual([]);
    // Absent is not a problem — it means the platform's list, which is a real answer.
    expect(creditRuleProblems({ ...base, installmentOptions: undefined })).toEqual([]);
  });

  it('survives the M14 save path the office actually uses', async () => {
    signOut();
    await signInAs(FACTORY_ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    const rules = config.creditRules ?? DEFAULT_CREDIT_RULES;

    await adminConfigRepository.patch(
      { creditRules: { ...rules, loan: { ...rules.loan, installmentOptions: [6, 12] } } },
      config,
      usage,
    );

    const saved = await adminConfigRepository.get();
    expect(installmentOptionsFor(saved.config.creditRules ?? DEFAULT_CREDIT_RULES, 'loan')).toEqual(
      [6, 12],
    );
  }, 20_000);
});

describe('M7 prices its queue with the tenant’s rule', () => {
  beforeEach(() => {
    signOut();
  });

  it('serves the rules on the config payload so the app and the office share them', async () => {
    await signInAs('manager@galabodatea.lk');
    const { config } = await adminConfigRepository.get();

    // Absent means the defaults — an existing `client_config` row keeps working.
    const rules = config.creditRules ?? DEFAULT_CREDIT_RULES;
    expect(rules.loan.basis).toBeTruthy();
  });

  it('re-prices the queue when the factory changes a rule', async () => {
    await signInAs(CLERK);
    const before = await creditRepository.list({ status: 'pending', pageSize: 25 });
    // A row with an actual ceiling: the fixture deliberately contains a short-history
    // supplier whose ceiling is zero, and halving a multiplier cannot move that.
    const row = before.items.find(
      (one) => one.facility === 'loan' && one.eligibility.ceiling > 0,
    );
    expect(row).toBeDefined();
    const ceilingBefore = row!.eligibility.ceiling;

    // Halve the multiplier through the configuration screen's own path.
    signOut();
    await signInAs(FACTORY_ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    const rules = config.creditRules ?? DEFAULT_CREDIT_RULES;
    await adminConfigRepository.patch(
      { creditRules: { ...rules, loan: { ...rules.loan, multiplier: 1 } } },
      config,
      usage,
    );

    signOut();
    await signInAs(CLERK);
    const after = await creditRepository.list({ status: 'pending', pageSize: 25 });
    const same = after.items.find((one) => one.id === row!.id)!;

    /**
     * The whole point of the feature: the office changes a number in M14 and the
     * queue's ceilings move on the next read. Recomputed per request, never stored —
     * a cached ceiling would keep offering headroom the factory has withdrawn.
     */
    expect(same.eligibility.ceiling).toBeLessThan(ceilingBefore);
  }, 20_000);
});
