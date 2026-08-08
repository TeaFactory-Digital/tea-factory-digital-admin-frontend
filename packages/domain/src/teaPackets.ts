/**
 * Tea packets — the factory's own tea, issued to the supplier who grew the leaf.
 *
 * **This file exists because v1 of the console had nothing for it.** The app has shipped
 * `RequestTeaPacketsScreen` from the first release, and the office had no queue, no type
 * and no flag: a supplier could ask, and nothing on earth could answer. That is the same
 * open loop M9 and M10 were built to close, left open on the one request the factory is
 * best placed to say yes to.
 *
 * The policy is a **catalogue of one**, deliberately. A packet is the factory's own made
 * tea in a standard pack, so unlike the manure catalogue there is no product to choose —
 * there is a pack weight and a price, and both are `client_config` because they are
 * exactly the kind of number that changes without a release (§21.10's shape, applied to a
 * question nobody had to ask).
 *
 * The value is recovered on the `deductions.tea` line of the next Green Leaf Account,
 * which puts it on the same footing as an advance instalment: money the factory has
 * already given, coming back off an account it has not yet built.
 */

import { floor2 } from './money';

/** What a packet is and what it costs. One row of `client_config`, not a catalogue. */
export interface TeaPacketPolicy {
  /** Weight of one packet in grams. 100 / 200 / 400 are the packs a factory store runs. */
  packGrams: number;
  /** LKR for one packet. */
  pricePerPacket: number;
  /**
   * The most a supplier may ask for on one request.
   *
   * A cap rather than an eligibility ceiling, and the difference is the whole reason
   * tea packets are not a `CreditFacility`: nothing here is priced off the supplier's
   * leaf. This is the store saying how much stock one person may take at once, which is
   * a policy the factory sets and an approver can see at a glance — not an arithmetic
   * the app has to reproduce byte for byte (AC-05).
   */
  maxPacketsPerRequest: number;
}

/**
 * The fallback when a `client_config` row predates the tea-packet block.
 *
 * A 400 g pack at LKR 1,200 with a cap of ten is the shape of the request the app
 * already lets a supplier make; it is a **default, not a guess at a factory's price**,
 * and M14 is where the real one is entered. Zero would have been the safer-looking
 * default and is the worse one: it prices every request at nothing and a queue of
 * LKR 0.00 rows reads as a working screen.
 */
export const DEFAULT_TEA_PACKET_POLICY: TeaPacketPolicy = {
  packGrams: 400,
  pricePerPacket: 1200,
  maxPacketsPerRequest: 10,
};

export type TeaPacketPolicyProblem = 'bad-pack' | 'negative-price' | 'bad-max';

/** What is wrong with a policy the office is about to save. Same shape as `manureProductProblems`. */
export function teaPacketPolicyProblems(policy: TeaPacketPolicy): TeaPacketPolicyProblem[] {
  const problems: TeaPacketPolicyProblem[] = [];

  if (!(policy.packGrams > 0)) problems.push('bad-pack');
  if (!(policy.pricePerPacket >= 0)) problems.push('negative-price');
  // A cap of zero makes every request refusable and the app's screen unusable, which is
  // what turning the flag off is for. It is a mistake, not a way to close the scheme.
  if (!Number.isInteger(policy.maxPacketsPerRequest) || policy.maxPacketsPerRequest < 1) {
    problems.push('bad-max');
  }

  return problems;
}

export function isTeaPacketPolicyUsable(policy: TeaPacketPolicy): boolean {
  return teaPacketPolicyProblems(policy).length === 0;
}

/**
 * What a request will cost on the account.
 *
 * `floor2` for the same reason every other figure in this package uses it: the factory
 * pays and deducts in whole cents, and a rounded-up rupee is money the supplier did not
 * agree to. Priced against the policy passed in, never a global — see
 * `AdminTeaPacketRequest.unitPrice` for why a decided request keeps the price it was
 * quoted at.
 */
export function teaPacketAmount(policy: TeaPacketPolicy, packets: number): number {
  if (!(packets > 0)) return 0;
  return floor2(packets * policy.pricePerPacket);
}

/** Total weight leaving the store, in kilos — what the storekeeper is actually issuing. */
export function teaPacketWeightKg(policy: TeaPacketPolicy, packets: number): number {
  if (!(packets > 0) || !(policy.packGrams > 0)) return 0;
  return floor2((packets * policy.packGrams) / 1000);
}

export type TeaPacketRequestProblem = 'no-packets' | 'over-max' | 'not-whole';

/**
 * Why this request cannot be approved as asked, or an empty list.
 *
 * Checked in the console **and** owed by the API. The app validates before it submits,
 * but a request raised at the counter by a clerk goes through the same door, and the
 * cap is the factory's stock policy rather than a client-side courtesy.
 */
export function teaPacketRequestProblems(
  policy: TeaPacketPolicy,
  packets: number,
): TeaPacketRequestProblem[] {
  const problems: TeaPacketRequestProblem[] = [];

  if (!(packets > 0)) problems.push('no-packets');
  // Half a packet is not something a store issues — the same rule that rounds manure
  // up to whole bags, stated as a refusal because there is nothing to round here.
  else if (!Number.isInteger(packets)) problems.push('not-whole');
  if (packets > policy.maxPacketsPerRequest) problems.push('over-max');

  return problems;
}
