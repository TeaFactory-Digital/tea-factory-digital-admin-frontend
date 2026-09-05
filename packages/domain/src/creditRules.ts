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
 * `maxAmount` did, and the same way `installmentOptions` since has.
 *
 * ## `installmentOptions` is here for a different reason from the rest
 *
 * The four fields above answer *"how much"*. `installmentOptions` answers *"over how
 * long"*, which is not a ceiling at all — it is here because it was the last piece of
 * credit policy still living in **two** places: a constant in the mobile bundle that the
 * picker rendered, and a list on the API that validated what the picker sent. Two lists
 * that agree until the first time one of them is edited. Putting it on the rule makes the
 * served config the only copy, which is the same argument that moved the ceilings here.
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
  /**
   * The repayment terms the factory offers, in monthly accounts. Ascending, no repeats.
   *
   * **On the rule because the alternative is two lists.** The app's instalment picker and
   * the server's validation of the chosen term were reading different sources — a constant
   * in the mobile bundle and a list on the API — so the failure mode was a supplier picking
   * a term the picker offered and the server then refused. One served list makes that
   * impossible rather than unlikely.
   *
   * **Ignored for `advance`**, the same way `averageOverMonths` is ignored unless the basis
   * is `averageIncome`. An advance is settled out of the next month's leaf in one go; there
   * is no term to choose, which is what separates it from a loan.
   *
   * Optional, and absent means `DEFAULT_CREDIT_RULES[facility].installmentOptions` — read
   * it through `installmentOptionsFor`, never directly, so a factory that has set no policy
   * keeps the terms it had before this field existed.
   */
  installmentOptions?: number[];
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
    // No `installmentOptions`: an advance has no term to choose.
  },
  loan: {
    requiredMonths: 6,
    basis: 'averageIncome',
    averageOverMonths: 6,
    multiplier: 3,
    maxAmount: null,
    /**
     * Three to twelve — the app's `LOAN_INSTALLMENT_OPTIONS`, moved rather than changed.
     *
     * Three is the floor because a loan is a larger sum than an advance and one account
     * cannot absorb it; twelve is the ceiling because the recovery has to finish inside a
     * plucking year.
     */
    installmentOptions: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  manure: {
    requiredMonths: 6,
    basis: 'lastSettledMonth',
    averageOverMonths: 6,
    multiplier: 1,
    maxAmount: null,
    /**
     * One to six — the app's `MANURE_INSTALLMENT_OPTIONS`, likewise unchanged.
     *
     * One is allowed because an issue is small enough for a single account to absorb; six
     * is the ceiling because the next round of fertilizer comes before the monsoon after
     * it, and two live balances would eat the whole ceiling.
     */
    installmentOptions: [1, 2, 3, 4, 5, 6],
  },
};

/**
 * The terms on offer for a facility — the factory's, or the platform's if it has set none.
 *
 * **The one function both sides call.** The app's picker renders what this returns and the
 * API validates the chosen term against what this returns, so "the supplier picked a term
 * the server rejects" stops being a state the system can reach. Reading
 * `rule.installmentOptions` directly is what re-introduces it, because `undefined` is a
 * real and common value — a factory that has never opened the screen.
 *
 * Takes the whole rule set, and takes `undefined` for it, because "this factory has set
 * no rules at all" and "this facility's rule carries no list" are the same state as far
 * as a caller is concerned — and a caller forced to distinguish them is a caller that
 * will get one of the two wrong.
 *
 * Empty for `advance`, which has no term.
 */
export function installmentOptionsFor(
  rules: CreditRules | undefined,
  facility: CreditFacility,
): readonly number[] {
  if (facility === 'advance') return [];
  return (
    rules?.[facility].installmentOptions ??
    DEFAULT_CREDIT_RULES[facility].installmentOptions ??
    []
  );
}

export type CreditRuleProblem =
  | 'negative-months'
  | 'bad-average-months'
  | 'negative-multiplier'
  | 'negative-max'
  | 'bad-installments';

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

  /**
   * Terms, when the rule carries any.
   *
   * `undefined` is not a problem — it is the ordinary state of a factory that has set no
   * policy, and `installmentOptionsFor` answers it with the platform's list. An **empty
   * array** is a problem, and the distinction is the point: it would leave the app with no
   * chip to offer and no way to submit, which reads on a phone as a broken screen rather
   * than as a facility that is switched off.
   *
   * Strictly ascending does the work of three checks at once — sorted, unique, and no
   * repeats — and sorted matters because the app renders them in the order they arrive.
   */
  const terms = rule.installmentOptions;
  if (terms !== undefined) {
    const bad =
      terms.length === 0 ||
      terms.some((months) => !Number.isInteger(months) || months < 1) ||
      terms.some((months, index) => index > 0 && months <= terms[index - 1]!);
    if (bad) problems.push('bad-installments');
  }

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
