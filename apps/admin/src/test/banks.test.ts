/**
 * The Sri Lankan bank and branch catalogue.
 *
 * Generated data, so the risk is not a typo in one branch name — it is a **regeneration
 * that quietly changes shape**. The source is a community-maintained dump of the SLIPS
 * participant list, and it is already inconsistent in ways that broke the first build of
 * this file: 169 branch codes arrive zero-padded as strings and 3,539 as bare integers,
 * one bank name has lost an ampersand and kept its spaces, and twenty-six branches share
 * a name with a sibling.
 *
 * None of that is visible in a diff of four thousand generated lines. So these assertions
 * are about the **normalisation the generator promises**, and each one names a failure the
 * office or a supplier would meet rather than a property that merely sounds tidy.
 */

import { describe, expect, it } from 'vitest';
import { SRI_LANKA_BANKS, SRI_LANKA_BANK_OPTIONS } from '@tfd/domain';

describe('the bank catalogue', () => {
  it('covers the country rather than one district', () => {
    /**
     * The whole reason the hand-written five-bank list was replaced. A supplier banking
     * with Seylan in Embilipitiya could not say so, and went to the counter to have it
     * typed in — which is the errand the payout screen exists to remove.
     */
    expect(SRI_LANKA_BANKS.length).toBeGreaterThanOrEqual(40);
    const branches = SRI_LANKA_BANKS.reduce((total, bank) => total + bank.branches.length, 0);
    expect(branches).toBeGreaterThan(3000);
  });

  it('gives every bank a branch to choose', () => {
    // A bank with an empty branch list is a dead end: the supplier picks it, the second
    // dropdown has nothing in it, and the form cannot be completed or abandoned cleanly.
    for (const bank of SRI_LANKA_BANKS) {
      expect(bank.branches.length, bank.name).toBeGreaterThan(0);
    }
  });

  it('offers no two branches under one name within a bank', () => {
    /**
     * Fourteen banks list "Head Office" twice, and DFCC has two Katugastotas. A dropdown
     * with the same word in it twice cannot be chosen from — whichever is picked, neither
     * the supplier nor the clerk checking the form afterwards can tell whether it was the
     * right one.
     */
    for (const bank of SRI_LANKA_BANKS) {
      const names = bank.branches.map((branch) => branch.name);
      expect(new Set(names).size, bank.name).toBe(names.length);
    }
  });

  it('keeps codes as padded strings, because a leading zero is part of one', () => {
    /**
     * The bug that surfaced first, as a TypeScript *octal literal* error. Emitted as
     * numbers these compile, and the padding is lost silently — a payout file written to
     * a fixed-width column would then carry `1` where the bank expects `001`, which is
     * the sort of error discovered by a bank rejecting a batch.
     */
    for (const bank of SRI_LANKA_BANKS) {
      expect(bank.code, bank.name).toMatch(/^\d{4}$/);
      for (const branch of bank.branches) {
        expect(branch.code, `${bank.name} / ${branch.name}`).toMatch(/^\d{3}$/);
      }
    }
  });

  it('has no name that renders as a different name', () => {
    /**
     * `'Hongkong   Shanghai Bank'` in the source: an ampersand dropped, three spaces left
     * behind. HTML collapses those on screen, so two values that look identical to a
     * reader compare unequal in code — noticed only as "the branch I picked did not save".
     */
    const names = [
      ...SRI_LANKA_BANKS.map((bank) => bank.name),
      ...SRI_LANKA_BANKS.flatMap((bank) => bank.branches.map((branch) => branch.name)),
    ];
    for (const name of names) {
      expect(name, JSON.stringify(name)).toBe(name.replace(/\s+/g, ' ').trim());
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('sorts for a human scrolling, not for a clearing system', () => {
    // The source is ordered by SLIPS code, which is meaningful to a bank and meaningless
    // to a supplier looking for their own name in a list of forty-five.
    const names = SRI_LANKA_BANKS.map((bank) => bank.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('projects to the config shape without losing a bank', () => {
    /**
     * `SRI_LANKA_BANK_OPTIONS` is what `client_config.banks` is seeded from and what the
     * app is served. A projection that dropped a bank would be invisible here and obvious
     * to the one supplier who banks there.
     */
    expect(SRI_LANKA_BANK_OPTIONS).toHaveLength(SRI_LANKA_BANKS.length);

    for (const [index, bank] of SRI_LANKA_BANKS.entries()) {
      const option = SRI_LANKA_BANK_OPTIONS[index];
      expect(option?.name, bank.name).toBe(bank.name);
      expect(option?.branches, bank.name).toEqual(bank.branches.map((branch) => branch.name));
    }
  });

  it('still contains the branches this factory actually pays into', () => {
    /**
     * The seed narrows the catalogue to the towns around Galaboda to keep its fixtures
     * believable, and does so by **filtering on these names**. A regeneration that renamed
     * "Akuressa" would leave that filter matching nothing, and the supplier fixtures would
     * come out with no bank details at all — a silent, wholesale change to what every
     * money screen is demonstrated with.
     */
    const branchesOf = (bank: string) =>
      SRI_LANKA_BANKS.find((one) => one.name === bank)?.branches.map((one) => one.name) ?? [];

    expect(branchesOf('Bank of Ceylon')).toEqual(
      expect.arrayContaining(['Akuressa', 'Matara', 'Deniyaya', 'Morawaka']),
    );
  });
});
