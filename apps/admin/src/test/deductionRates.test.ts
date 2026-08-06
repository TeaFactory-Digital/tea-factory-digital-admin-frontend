/**
 * §21.10, as the factory answered it.
 *
 * The answer reshaped the question. It was *"which lines may the office set per supplier?"*
 * and the answer was **almost none** — transport and stamps are one factory-wide figure
 * each, the credit instalments are the supplier's own repayment choice under a cap, and
 * everything else is already somebody's request. So the tests are about the two halves that
 * remained:
 *
 *  - **The cap and the supplier's chosen period**, which together decide what comes off an
 *    account. The interesting case is the month where they disagree.
 *  - **Four eyes**, because the factory said yes to it — and a transport rate is a different
 *    sum on every account in the factory, which nobody would notice for a month.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DEDUCTION_RATES,
  creditInstalment,
  deductionRateDiff,
  deductionRateProblems,
  findManureProduct,
  manureAmount,
  manurePacks,
  manureProductProblems,
  round2,
} from '@tfd/domain';
import { deductionRateRepository } from '@/services/repositories/deductionRateRepository';
import { billRepository } from '@/services/repositories/billRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { creditRepository } from '@/services/repositories/creditRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

describe('the instalment a supplier actually repays', () => {
  /**
   * **The two bounds, and the month they disagree.**
   *
   * A supplier who chose six months on a 12,000 balance owes 2,000 a month. In a good month
   * (gross 40,000, 20% cap = 8,000) their choice is what binds. In a poor one (gross 6,000,
   * cap 1,200) the cap is — which is the whole reason the cap survived the factory's answer
   * rather than being replaced by the period.
   */
  it('takes the smaller of what the supplier chose and what the month can bear', () => {
    const plan = { amount: 12_000, months: 6 };
    expect(creditInstalment(12_000, 40_000, 0.2, plan)).toBe(2000);
    expect(creditInstalment(12_000, 6_000, 0.2, plan)).toBe(1200);
  });

  /**
   * **The instalment is priced off what was borrowed, not off what is left**, and this test
   * is why. `balance / months` looks equivalent and decays geometrically — 2,000, then
   * 1,667, then 1,389 — an instalment that shrinks for ever and never clears the debt. The
   * first version of this function did exactly that, and this case caught it.
   */
  it('clears the debt instead of shrinking towards it for ever', () => {
    const plan = { amount: 12_000, months: 6 };
    let balance = 12_000;
    let months = 0;

    while (balance > 0 && months < 24) {
      balance = round2(balance - creditInstalment(balance, 40_000, 0.2, plan));
      months += 1;
    }

    expect(months).toBe(6);
    expect(balance).toBe(0);
  });

  it('never takes more than is owed, whatever either bound says', () => {
    // The last instalment: 500 left on a plan whose scheduled figure is larger.
    expect(creditInstalment(500, 40_000, 0.2, { amount: 12_000, months: 6 })).toBe(500);
  });

  /**
   * No period — every credit approved before the app could ask for one — falls back to the
   * cap alone, which is exactly what the console did before §21.10 was answered.
   */
  it('falls back to the cap when the supplier never chose a period', () => {
    expect(creditInstalment(12_000, 40_000, 0.2)).toBe(8000);
    expect(creditInstalment(12_000, 40_000, 0.2, null)).toBe(8000);
  });

  it('takes nothing from an account with no leaf and nothing from a clear balance', () => {
    const plan = { amount: 12_000, months: 6 };
    expect(creditInstalment(12_000, 0, 0.2, plan)).toBe(0);
    expect(creditInstalment(0, 40_000, 0.2, plan)).toBe(0);
  });
});

describe('what makes a rate unusable', () => {
  it('refuses a share that would take more than the account earned', () => {
    const bad = {
      ...DEFAULT_DEDUCTION_RATES,
      instalmentShares: { advance: 1.5, loan: 0.2, manure: 0.15 },
    };
    // Over 1 reaches a payout run as a negative line, which a bank file cannot express.
    expect(deductionRateProblems(bad)).toContain('share-out-of-range');
  });

  it('refuses a negative charge, and allows the shipped set', () => {
    expect(deductionRateProblems({ ...DEFAULT_DEDUCTION_RATES, transportPerKg: -1 })).toContain(
      'negative-transport',
    );
    expect(deductionRateProblems({ ...DEFAULT_DEDUCTION_RATES, stamps: -5 })).toContain(
      'negative-stamps',
    );
    expect(deductionRateProblems(DEFAULT_DEDUCTION_RATES)).toEqual([]);
  });

  it('names exactly what a proposal would change, so an approver reads a diff', () => {
    const proposed = { ...DEFAULT_DEDUCTION_RATES, transportPerKg: 4.5 };
    expect(deductionRateDiff(DEFAULT_DEDUCTION_RATES, proposed)).toEqual([
      { field: 'transportPerKg', from: 2.5, to: 4.5 },
    ]);
    expect(deductionRateDiff(DEFAULT_DEDUCTION_RATES, DEFAULT_DEDUCTION_RATES)).toEqual([]);
  });
});

describe('the fertilizer catalogue', () => {
  const urea = { name: 'Urea', packKg: 50, pricePerPack: 8500 };

  /**
   * **Priced by the bag, and the rounding is the assertion.**
   *
   * A store issues whole sacks. A supplier asking for 60 kg of a 50 kg product is handed two
   * bags and owes for two — pricing the 60 kg pro rata (LKR 10,200) would put a figure on
   * the account that does not match what left the store, and the supplier is holding the
   * bags to prove it.
   */
  it('charges for whole bags, rounded up', () => {
    expect(manurePacks(urea, 50)).toBe(1);
    expect(manurePacks(urea, 60)).toBe(2);
    expect(manurePacks(urea, 100)).toBe(2);

    expect(manureAmount(urea, 100)).toBe(17_000);
    expect(manureAmount(urea, 60)).toBe(17_000);
    expect(manureAmount(urea, 50)).toBe(8500);
  });

  it('refuses a catalogue a request could not be priced against', () => {
    // A zero pack divides by zero on the next request that names it.
    expect(manureProductProblems([{ ...urea, packKg: 0 }])).toContain('bad-pack');
    expect(manureProductProblems([{ ...urea, name: ' ' }])).toContain('no-name');
    expect(manureProductProblems([{ ...urea, pricePerPack: -1 }])).toContain('negative-price');
    // Two rows with one name: a request naming it could not say which.
    expect(manureProductProblems([urea, { ...urea, pricePerPack: 9000 }])).toContain(
      'duplicate-name',
    );
    expect(manureProductProblems([urea])).toEqual([]);
  });

  it('serves a catalogue the credit queue can actually price against', async () => {
    signOut();
    // The manager, because §12.1 gives the accountant no `flagsAndBranding` at all — and
    // the manager is who decides a fertilizer request, so they are who needs to see its
    // price. The pricing itself is the server's, which is why the accountant not holding
    // the catalogue costs nothing.
    await signInWithMfaAs(MANAGER);
    const { config } = await adminConfigRepository.get();
    const products = config.manureProducts ?? [];

    expect(products.length).toBeGreaterThan(0);
    expect(manureProductProblems(products)).toEqual([]);

    /**
     * Every fertilizer M7 has a request for is in the catalogue.
     *
     * The two used to be separate lists in the fixture, which meant a queue could name a
     * type the configuration screen did not offer — and then nobody could price it.
     */
    const queue = await creditRepository.list({ facility: 'manure', pageSize: 50 });
    for (const request of queue.items) {
      expect(findManureProduct(products, request.manureType), request.manureType ?? '').toBeTruthy();
    }
  }, 20_000);
});

describe('§21.10 rates against the mock API', () => {
  beforeEach(() => {
    signOut();
  });

  it('says out loud that a factory is running on figures nobody chose', async () => {
    await signInAs(ACCOUNTANT);
    const state = await deductionRateRepository.get();

    // The fixture has never set its own, and the screen has to be able to say so — an
    // invented transport charge presented as a decision is how it gets quoted at a supplier.
    expect(state.customised).toBe(false);
    expect(state.rates).toEqual(DEFAULT_DEDUCTION_RATES);
    expect(state.pending).toBeNull();
  }, 20_000);

  /**
   * **The four-eyes rule, which is what the factory asked for.**
   *
   * Reachable because `approve` implies `write`: a manager *could* propose a rate and
   * approve it themselves, and this is the check that stops them. Same shape as publishing
   * a month whose rate you entered.
   */
  it('refuses the approval of a change you proposed yourself (BR-501)', async () => {
    await signInWithMfaAs(MANAGER);
    const change = await deductionRateRepository.propose(
      { ...DEFAULT_DEDUCTION_RATES, transportPerKg: 3.5 },
      'Fuel has gone up since the last review',
    );

    const refused = await deductionRateRepository
      .decide(change.id, 'approve')
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('four-eyes-violation');

    // Nothing took effect — a refused approval must not half-apply.
    const state = await deductionRateRepository.get();
    expect(state.rates.transportPerKg).toBe(2.5);
    expect(state.pending?.id).toBe(change.id);
  }, 30_000);

  it('changes nothing until a second person approves, then changes everything', async () => {
    await signInAs(ACCOUNTANT);
    const change = await deductionRateRepository.propose(
      { ...DEFAULT_DEDUCTION_RATES, transportPerKg: 4.5, stamps: 40 },
      'Agreed with the collection contractor for this season',
    );
    expect(change.status).toBe('pending');

    // Proposing is not setting.
    const proposed = await deductionRateRepository.get();
    expect(proposed.rates.transportPerKg).toBe(2.5);
    expect(proposed.customised).toBe(false);

    signOut();
    await signInWithMfaAs(MANAGER);
    await deductionRateRepository.decide(change.id, 'approve');

    const active = await deductionRateRepository.get();
    expect(active.rates.transportPerKg).toBe(4.5);
    expect(active.rates.stamps).toBe(40);
    expect(active.customised).toBe(true);
    expect(active.pending).toBeNull();
  }, 30_000);

  /**
   * The rate has to reach the **bill**, or the screen is a form that saves into nothing —
   * the same argument AC-12 makes about `GET /config`.
   */
  it('re-prices the next bill run, and only the next one', async () => {
    await signInAs(ACCOUNTANT);
    const change = await deductionRateRepository.propose(
      { ...DEFAULT_DEDUCTION_RATES, transportPerKg: 5 },
      'Doubling transport to prove it reaches the account',
    );
    signOut();
    await signInWithMfaAs(MANAGER);
    await deductionRateRepository.decide(change.id, 'approve');

    signOut();
    await signInAs(ACCOUNTANT);
    const months = await billRepository.months();
    const open = months.find((month) => month.open)!;
    // The open month has no rate by fixture design, and a run needs one.
    await monthRepository.setRate(open.monthKey, { ratePerKg: 122.5, extraRatePerKg: 8 });
    await billRepository.generate(open.monthKey);

    const bills = await billRepository.list({ monthKey: open.monthKey, pageSize: 5 });
    const detail = await billRepository.get(bills.items[0]!.id);
    // Transport is kilos × the rate the factory approved, not the shipped 2.50.
    expect(detail.deductions.transportCharges).toBe(round2(detail.totalKgs * 5));
    expect(detail.deductions.stamps).toBe(DEFAULT_DEDUCTION_RATES.stamps);
  }, 60_000);

  it('takes one proposal at a time', async () => {
    await signInAs(ACCOUNTANT);
    await deductionRateRepository.propose(
      { ...DEFAULT_DEDUCTION_RATES, stamps: 30 },
      'First proposal for the queue test',
    );

    // Two pending sets would mean approving one while another waited to overwrite it.
    await expect(
      deductionRateRepository.propose(
        { ...DEFAULT_DEDUCTION_RATES, stamps: 35 },
        'Second proposal, which should be refused',
      ),
    ).rejects.toMatchObject({ code: 'change-pending' });
  }, 20_000);

  it('insists on a reason, and refuses an unusable set before it is proposed', async () => {
    await signInAs(ACCOUNTANT);

    await expect(
      deductionRateRepository.propose(DEFAULT_DEDUCTION_RATES, 'short'),
    ).rejects.toMatchObject({ code: 'note-required' });

    // Refused on the client by the shared rule, before a round trip.
    await expect(
      deductionRateRepository.propose(
        { ...DEFAULT_DEDUCTION_RATES, instalmentShares: { advance: 2, loan: 0.2, manure: 0.15 } },
        'A share that would take more than the account earned',
      ),
    ).rejects.toMatchObject({ code: 'invalid-rates' });
  }, 20_000);

  it('gives a clerk none of it (§12.1)', async () => {
    await signInAs(CLERK);
    // `ratesAndMonthClose: —` for the clerk. Not even the read.
    const refused = await deductionRateRepository.get().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  }, 20_000);

  it('audits the proposal and the decision with the figures on both sides (AC-09)', async () => {
    await signInAs(ACCOUNTANT);
    const change = await deductionRateRepository.propose(
      { ...DEFAULT_DEDUCTION_RATES, stamps: 45 },
      'Stamp duty went up in the budget',
    );
    signOut();
    await signInWithMfaAs(MANAGER);
    await deductionRateRepository.decide(change.id, 'approve');

    const audit = await auditRepository.list({ entity: 'deductionRates' });
    const actions = audit.items.map((one) => one.action);
    expect(actions).toContain('deductionRates.propose');
    expect(actions).toContain('deductionRates.approve');

    // Before *and* after — "who widened this, and from what" is the only question ever
    // asked about a rate change, and it gets asked months later.
    const approved = audit.items.find((one) => one.action === 'deductionRates.approve')!;
    expect((approved.before as { stamps: number }).stamps).toBe(25);
    expect((approved.after as { stamps: number }).stamps).toBe(45);
  }, 30_000);
});
