/**
 * The factory's own credit rules — **configuration, not code.**
 *
 * Until now the three ceilings were hard-coded formulas with two constants
 * (`REQUIRED_MONTHS_OF_HISTORY`, `LIMIT_MULTIPLIER`) baked into the build. Which meant
 * a factory that wanted *"manure: average the last three months, capped at 20,000"*
 * needed a release — and that is precisely the shape of thing white-label.md says must
 * be a `client_config` row rather than a deploy.
 *
 * It also matters more than the other configurable values do. A factory already runs
 * its own lending policy, and a policy this platform guessed at is a ceiling the app
 * shows a supplier that the office then refuses. **A wrong limit is a supplier told
 * they may borrow money they may not**, which is a worse conversation than any missing
 * feature.
 *
 * ## The shape, and why it is these four fields
 *
 * Every ceiling any of the three facilities has ever used is *"take a basis, multiply
 * it, cap it, and require some history first"*. Rather than a rule engine, this is
 * that sentence with the four blanks filled in — which is small enough for an office
 * administrator to reason about and expressive enough to cover the formulas already
 * shipped:
 *
 * | Facility | Today's formula | As a rule |
 * | --- | --- | --- |
 * | Advance | last settled rate × **this** month's kilos | `thisMonthLeaf` × 1 |
 * | Loan | 3 × average income over 6 settled months | `averageIncome` (6) × 3 |
 * | Manure | last settled rate × **that** month's kilos | `lastSettledMonth` × 1 |
 *
 * And the example that prompted it — *manure, last 3 months ÷ 3, capped at 20,000* —
 * is `averageIncome` over 3 months × 1, `maxAmount: 20000`.
 *
 * ## What it deliberately cannot express
 *
 * No per-supplier rules, no tiers, no seasonal variation. Each of those is a policy
 * the factory has not asked for, and a rule engine nobody needs is a screen nobody can
 * fill in correctly. When one is asked for, it arrives as a field here — the same way
 * `maxAmount` did.
 */

import type { CreditFacility } from './types/app';

/**
 * What the ceiling is multiplied *from*.
 *
 * Three, because the three facilities genuinely price off different things and always
 * have: an advance is against leaf already in the shed, a loan against a track record,
 * and manure against the last month that settled.
 */
export type CreditRuleBasis =
  /** Last settled rate per kg × **this** month's kilos. Leaf already delivered. */
  | 'thisMonthLeaf'
  /** Last settled rate per kg × **that** month's kilos. */
  | 'lastSettledMonth'
  /** Average monthly income over `averageOverMonths` settled months. */
  | 'averageIncome';

export interface CreditRule {
  /**
   * Settled months the supplier must have before the facility is offered at all.
   *
   * `0` means no requirement, which is right for an advance: it is cash against leaf
   * already weighed, so a supplier in their first month qualifies for it and for
   * nothing else.
   */
  requiredMonths: number;
  basis: CreditRuleBasis;
  /** Months averaged when `basis` is `averageIncome`. Ignored otherwise. */
  averageOverMonths: number;
  /** Multiplies the basis. `1` is a real answer, not "unset". */
  multiplier: number;
  /**
   * Hard cap in LKR, or `null` for none.
   *
   * `null` rather than a large number, so "uncapped" is a state rather than a figure
   * somebody has to recognise as meaning uncapped.
   */
  maxAmount: number | null;
}

export type CreditRules = Record<CreditFacility, CreditRule>;

/**
 * The rules a factory runs on before it sets its own — **exactly the behaviour that
 * was hard-coded**, so turning this into configuration changed no ceiling anywhere.
 *
 * That property is worth keeping: a factory that never opens the screen must not
 * discover that its lending quietly moved on the day the feature shipped.
 */
export const DEFAULT_CREDIT_RULES: CreditRules = {
  advance: {
    requiredMonths: 0,
    basis: 'thisMonthLeaf',
    averageOverMonths: 6,
    multiplier: 1,
    maxAmount: null,
  },
  loan: {
    requiredMonths: 6,
    basis: 'averageIncome',
    averageOverMonths: 6,
    multiplier: 3,
    maxAmount: null,
  },
  manure: {
    requiredMonths: 6,
    basis: 'lastSettledMonth',
    averageOverMonths: 6,
    multiplier: 1,
    maxAmount: null,
  },
};

export type CreditRuleProblem =
  | 'negative-months'
  | 'bad-average-months'
  | 'negative-multiplier'
  | 'negative-max';

/**
 * What is wrong with a rule the office is about to save.
 *
 * A ceiling is the figure a supplier is told they may borrow, so every one of these
 * blocks the save rather than warning about it. A `multiplier` of `0` would offer
 * every supplier a ceiling of zero and read on screen as *"nobody may borrow"* —
 * which is what turning the feature off is for, and a rule that silently means it is
 * a rule the office will misread.
 */
export function creditRuleProblems(rule: CreditRule): CreditRuleProblem[] {
  const problems: CreditRuleProblem[] = [];

  if (!Number.isInteger(rule.requiredMonths) || rule.requiredMonths < 0) {
    problems.push('negative-months');
  }
  // Averaging over zero months divides by zero on the next request that reads it.
  if (!Number.isInteger(rule.averageOverMonths) || rule.averageOverMonths < 1) {
    problems.push('bad-average-months');
  }
  if (!(rule.multiplier > 0)) problems.push('negative-multiplier');
  if (rule.maxAmount !== null && !(rule.maxAmount > 0)) problems.push('negative-max');

  return problems;
}

export function areCreditRulesUsable(rules: CreditRules): boolean {
  return Object.values(rules).every((rule) => creditRuleProblems(rule).length === 0);
}

/**
 * A plain-language reading of a rule, as an i18n key and its parameters.
 *
 * A key rather than a sentence, because this is shared with an API that has no string
 * table — the same shape `configImpact` and `describeAudience` use. It exists so the
 * configuration screen can show *"3 × the average of 6 months, at least 6 months of
 * history"* under the fields, rather than leaving an administrator to work out what
 * four numbers add up to.
 */
export function describeCreditRule(rule: CreditRule): {
  messageKey: string;
  params: Record<string, string | number>;
} {
  return {
    messageKey: `credit.rule.basis.${rule.basis}.summary`,
    params: {
      multiplier: rule.multiplier,
      months: rule.averageOverMonths,
      requiredMonths: rule.requiredMonths,
      max: rule.maxAmount ?? 0,
    },
  };
}
