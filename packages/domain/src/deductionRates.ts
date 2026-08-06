/**
 * The figures behind M5's deduction lines — **§21.10, as the factory answered it.**
 *
 * The question was *"which lines may the office set per supplier, and who may set them?"*,
 * and the answer reshaped it: **almost none of them are typed per supplier at all.**
 *
 *  - **Transport per kilo and stamps** are one factory-wide figure each, changed by the
 *    manager. They are in here.
 *  - **The credit instalments** are the supplier's own choice — they ask to repay, and they
 *    choose over how many months — with a share-of-gross cap the factory sets. The cap is in
 *    here; the choice arrives with the request.
 *  - **Tea, savings and the advance** are all things the supplier asks for. None is a field
 *    on this screen.
 *  - **Previous debts** is derived and never set by anybody.
 *
 * Which leaves `otherCards`, and the factory has not said what it is. That one line stays
 * uneditable and §21.10 stays open for it — see status.md.
 *
 * **Why these need two people.** The factory's answer to *"does a change need a second
 * person?"* was yes, and it is the right instinct: transport at LKR 2.50/kg against LKR
 * 4.50/kg is a different sum on every account in the factory, and nobody would notice for a
 * month. So the shape here is M4's, not M14's — a rate is *proposed* and a second person
 * *approves* it, which is exactly how the monthly green-leaf rate already works. That is
 * also why these live under `ratesAndMonthClose` (the accountant proposes, the manager
 * approves) rather than under `flagsAndBranding` with the logo.
 */

import { round2 } from './money';
import type { CreditFacility } from './types/app';

/* ──────────────────────────────── the rates ──────────────────────────────── */

export interface DeductionRates {
  /** Collection from the estate, per kilo of green leaf. */
  transportPerKg: number;
  /** The flat stamp duty every account carries. */
  stamps: number;
  /**
   * The **most** of a month's gross any one facility may take back.
   *
   * A cap, not a schedule: the supplier chooses the repayment period, and this stops a
   * facility swallowing an account whatever they chose. A supplier paid nothing telephones
   * the office and is right to.
   */
  instalmentShares: Record<CreditFacility, number>;
}

/**
 * What a factory gets before anybody has set anything.
 *
 * These were the mock's invented figures, and moving them here does not make them true —
 * it makes them **changeable without a developer**, which is the whole of §21.10's answer.
 * A factory that has not set its own is still running on a guess, and the screen says so.
 */
export const DEFAULT_DEDUCTION_RATES: DeductionRates = {
  transportPerKg: 2.5,
  stamps: 25,
  instalmentShares: { advance: 0.3, loan: 0.2, manure: 0.15 },
};

export type DeductionRateProblem =
  | 'negative-transport'
  | 'negative-stamps'
  | 'share-out-of-range';

/**
 * What is wrong with a proposed set, shared so the screen refuses before the round trip.
 *
 * A share above 1 would take more than the account earned, which reaches a payout run as a
 * negative line — the thing `computeBillAmounts` has a whole branch to avoid.
 */
export function deductionRateProblems(rates: DeductionRates): DeductionRateProblem[] {
  const problems: DeductionRateProblem[] = [];
  if (!(rates.transportPerKg >= 0)) problems.push('negative-transport');
  if (!(rates.stamps >= 0)) problems.push('negative-stamps');
  if (
    Object.values(rates.instalmentShares).some((share) => !(share >= 0) || share > 1)
  ) {
    problems.push('share-out-of-range');
  }
  return problems;
}

export function areDeductionRatesUsable(rates: DeductionRates): boolean {
  return deductionRateProblems(rates).length === 0;
}

/* ─────────────────────────── the instalment itself ─────────────────────────── */

/**
 * How much of a credit balance comes off this month's account.
 *
 * **Two things bound it, and both matter:**
 *
 *  1. **The supplier's chosen period.** They asked to repay over `months`, so the instalment
 *     is their balance spread across it. That choice is the answer to §21.10's second half —
 *     the office does not decide what a supplier repays, the supplier does.
 *  2. **The factory's cap**, as a share of the month's gross. A supplier who chose six
 *     months and then had a month with almost no leaf would otherwise see their whole
 *     account disappear into a repayment they agreed to when they were plucking well.
 *
 * So it is the **smaller** of the two, and never more than the balance still owed. No plan
 * — every credit approved before the app could ask for a period — falls back to the cap
 * alone, which is what this console did before §21.10 was answered.
 *
 * **The plan is priced off what was borrowed, not off what is left**, and that is not a
 * detail. `balance / months` looks equivalent and decays geometrically: 12,000 over six
 * months takes 2,000, then 1,667 of the remaining 10,000, then 1,389 — an instalment that
 * shrinks for ever and **never clears the debt**. A repayment plan is a fixed instalment,
 * and the last one is whatever is left.
 */
export interface RepaymentPlan {
  /** What was borrowed — the figure the instalment was agreed against. */
  amount: number;
  /** Accounts the supplier chose to spread it over. */
  months: number;
}

export function creditInstalment(
  balance: number,
  grossAmount: number,
  share: number,
  plan?: RepaymentPlan | null,
): number {
  if (balance <= 0 || grossAmount <= 0) return 0;

  const cap = grossAmount * share;
  const scheduled =
    plan && plan.months > 0 && plan.amount > 0
      ? plan.amount / plan.months
      : Number.POSITIVE_INFINITY;

  return round2(Math.min(balance, cap, scheduled));
}

/* ──────────────────────────── proposing a change ──────────────────────────── */

/**
 * A rate change waiting for a second person.
 *
 * `pending` until somebody who did not propose it approves. Modelled as a record rather
 * than a field on the config for the same reason a payout run is a record: *who proposed
 * this, who released it, and what were the figures before* is the question asked six months
 * later, and a value that was simply overwritten cannot answer it.
 */
export type DeductionRateChangeStatus = 'pending' | 'approved' | 'rejected';

export interface DeductionRateChange {
  id: string;
  status: DeductionRateChangeStatus;
  /** What the factory would move to. */
  proposed: DeductionRates;
  /** What it is now, frozen at proposal time so the diff cannot drift. */
  current: DeductionRates;
  reason: string;
  proposedAt: string;
  proposedById: string;
  proposedByName: string;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
}

/**
 * What `GET /admin/deduction-rates` answers.
 *
 * In the domain package because the API implements it too — and `customised` in particular
 * is the server's answer: only it knows whether this factory has ever set its own.
 */
export interface DeductionRateState {
  rates: DeductionRates;
  customised: boolean;
  pending: DeductionRateChange | null;
  history: DeductionRateChange[];
}

/** Everything a proposal would change, for a screen that has to show it before approval. */
export function deductionRateDiff(
  current: DeductionRates,
  proposed: DeductionRates,
): Array<{ field: string; from: number; to: number }> {
  const out: Array<{ field: string; from: number; to: number }> = [];

  if (current.transportPerKg !== proposed.transportPerKg) {
    out.push({ field: 'transportPerKg', from: current.transportPerKg, to: proposed.transportPerKg });
  }
  if (current.stamps !== proposed.stamps) {
    out.push({ field: 'stamps', from: current.stamps, to: proposed.stamps });
  }
  for (const facility of Object.keys(proposed.instalmentShares) as CreditFacility[]) {
    const from = current.instalmentShares[facility];
    const to = proposed.instalmentShares[facility];
    if (from !== to) out.push({ field: `instalmentShares.${facility}`, from, to });
  }

  return out;
}

/* ─────────────────────────── the fertilizer catalogue ─────────────────────────── */

/**
 * One fertilizer the factory sells on credit (§21.10).
 *
 * **A name is not enough**, which is what a bag makes obvious: a supplier asks for *two bags
 * of urea*, and the account has to carry a rupee figure. So the catalogue holds the pack
 * size and the price of a pack, and the amount is derived — never typed by whoever keys the
 * request in, because a hand-typed price is a price nobody can check against a list.
 *
 * `packKg` because fertilizer is sold in bags, not by the kilo: 50 kg is the usual sack, and
 * a supplier who asks for "100 kg" means two of them. The app's `ManureRequest.quantityKg`
 * stays in kilos — that is the shared type and it is the honest unit for a weight — and
 * `manurePacks` converts.
 *
 * **Not under the four-eyes rates**, and the distinction is worth stating: transport and
 * stamps are *imposed* on every account whether the supplier wants them or not, so they
 * need two people. A price list is something a supplier chooses to buy from or decline. If
 * the factory disagrees, moving this into `DeductionRates` is where it would go.
 */
export interface ManureProduct {
  name: string;
  /** Kilos in one bag. 50 is the usual sack. */
  packKg: number;
  /** LKR for one bag. */
  pricePerPack: number;
}

export type ManureProductProblem = 'no-name' | 'bad-pack' | 'negative-price' | 'duplicate-name';

export function manureProductProblems(products: readonly ManureProduct[]): ManureProductProblem[] {
  const problems: ManureProductProblem[] = [];
  const names = products.map((one) => one.name.trim().toLowerCase());

  if (products.some((one) => !one.name.trim())) problems.push('no-name');
  // A zero pack size divides by zero on the next request that names it.
  if (products.some((one) => !(one.packKg > 0))) problems.push('bad-pack');
  if (products.some((one) => !(one.pricePerPack >= 0))) problems.push('negative-price');
  if (new Set(names).size !== names.length) problems.push('duplicate-name');

  return problems;
}

/** Bags, rounded up: half a sack is not something a store issues. */
export function manurePacks(product: ManureProduct, quantityKg: number): number {
  if (!(product.packKg > 0)) return 0;
  return Math.ceil(quantityKg / product.packKg);
}

/**
 * What a fertilizer request costs, priced off the catalogue.
 *
 * **By the bag, not by the kilo**, which is the whole reason `packKg` is here: a store
 * issues whole sacks, so a supplier asking for 60 kg of a 50 kg product is issued two bags
 * and owes for two. Pricing the 60 kg pro rata would put a figure on the account that does
 * not match what left the store.
 */
export function manureAmount(product: ManureProduct, quantityKg: number): number {
  return round2(manurePacks(product, quantityKg) * product.pricePerPack);
}

/** The product a request names, or `null` when the catalogue no longer carries it. */
export function findManureProduct(
  products: readonly ManureProduct[],
  name: string | null,
): ManureProduct | null {
  if (!name) return null;
  return products.find((one) => one.name === name) ?? null;
}
