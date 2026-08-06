/**
 * Money arithmetic and the credit basis.
 *
 * status.md §10 item 10 records that **no tests cover the credit rules** in the
 * mobile app. These are that gap closed on the console side, and they test the one
 * property that will otherwise cause a real dispute: a ceiling the app shows and
 * the server rejects.
 */

import { describe, expect, it } from 'vitest';
import {
  averageMonthlyIncome,
  deductionsBalance,
  floor2,
  hasRequiredHistory,
  lastSettledBill,
  loanCeiling,
  maskAccountNumber,
  monthsOfHistory,
  round2,
  type GreenLeafBill,
} from '@tfd/domain';

/** A minimal bill: only the fields the credit basis reads. */
function bill(monthKey: string, gross: number | null, kgs = 500, rate: number | null = 120): GreenLeafBill {
  return {
    id: monthKey,
    factory: { name: 'F', telephone: '', regNo: '', location: '' },
    supplierCode: '5708',
    supplierName: 'Test',
    billNo: monthKey,
    billDateTime: `${monthKey}-01T00:00:00.000Z`,
    month: monthKey,
    monthKey,
    year: Number(monthKey.slice(0, 4)),
    auctionResultAvailable: gross !== null,
    ratePerKg: rate,
    extraRatePerKg: null,
    totalRatePerKg: gross === null ? null : rate,
    totalKgs: kgs,
    coinsBroughtForward: 0,
    savingsWithdrawal: 0,
    greenLeafAmount: gross,
    extraPayment: null,
    grossAmount: gross,
    deductions: {
      transportCharges: 0,
      tea: 0,
      savings: 0,
      loansAdvance: 0,
      advance: 0,
      manure: 0,
      otherCards: 0,
      stamps: 0,
      previousDebts: 0,
      total: 0,
    },
    balanceAmount: gross,
    coinsCarriedForward: 0,
    finalBalance: gross,
    carryForward: { nextMonthDeb: 0, loanBalance: 0, manureBalance: 0, loanInterest: 0 },
    savingsSummary: { thisMonth: 0, previous: 0, toDate: 0 },
    dailySupply: [],
    paymentMethod: 'bankTransfer',
  };
}

describe('floor2 / round2', () => {
  it('truncates a ceiling rather than rounding it up', () => {
    // The whole reason `floor2` exists: a ceiling that rounds up is a maximum the
    // supplier cannot type, because the validator rejects the figure the screen
    // printed (BR-308).
    expect(floor2(89_619.039)).toBe(89_619.03);
    expect(floor2(100.999)).toBe(100.99);
  });

  it('rounds an amount', () => {
    expect(round2(100.995)).toBe(101);
    expect(round2(100.994)).toBe(100.99);
  });

  it('never rounds a ceiling above its true value', () => {
    for (const value of [1.005, 2.675, 89_619.999, 0.019]) {
      expect(floor2(value)).toBeLessThanOrEqual(value);
    }
  });
});

describe('the credit basis (§9.2)', () => {
  // Newest first: [0] is the month in progress and has no rate.
  const bills = [
    bill('2026-07', null),
    bill('2026-06', 60_000),
    bill('2026-05', 55_000),
    bill('2026-04', 65_000),
    bill('2026-03', 58_000),
    bill('2026-02', 62_000),
    bill('2026-01', 60_000),
  ];

  it('never treats the month in progress as settled', () => {
    expect(lastSettledBill(bills)?.monthKey).toBe('2026-06');
  });

  it('counts only closed months as history', () => {
    expect(monthsOfHistory(bills)).toBe(6);
    expect(hasRequiredHistory(bills)).toBe(true);
  });

  it('returns 0 for an average over short history, so a caller fails closed', () => {
    // A forgotten history check must yield a zero ceiling, not a loan priced off
    // two months.
    const short = [bill('2026-07', null), bill('2026-06', 60_000), bill('2026-05', 55_000)];
    expect(averageMonthlyIncome(short)).toBe(0);
    expect(loanCeiling(short)).toBe(0);
    expect(hasRequiredHistory(short)).toBe(false);
  });

  it('averages gross amounts and truncates', () => {
    // (60000+55000+65000+58000+62000+60000) / 6 = 60000
    expect(averageMonthlyIncome(bills)).toBe(60_000);
  });

  it('prices a loan at 3× average income', () => {
    expect(loanCeiling(bills)).toBe(180_000);
  });

  it('truncates a loan ceiling that does not divide evenly', () => {
    const awkward = [
      bill('2026-07', null),
      bill('2026-06', 10_000.01),
      bill('2026-05', 10_000.01),
      bill('2026-04', 10_000.01),
      bill('2026-03', 10_000.01),
      bill('2026-02', 10_000.01),
      bill('2026-01', 10_000.01),
    ];
    const ceiling = loanCeiling(awkward);
    expect(ceiling).toBe(floor2(ceiling));
    expect(ceiling).toBeLessThanOrEqual(10_000.01 * 3);
  });
});

describe('deductionsBalance (BR-107)', () => {
  it('accepts lines that sum to the total', () => {
    expect(
      deductionsBalance({ transportCharges: 100, tea: 50, savings: 25, total: 175 }),
    ).toBe(true);
  });

  it('rejects lines that do not', () => {
    // Finding this after publishing is finding it too late — it is an M4 exception.
    expect(
      deductionsBalance({ transportCharges: 100, tea: 50, savings: 25, total: 200 }),
    ).toBe(false);
  });
});

describe('maskAccountNumber', () => {
  it('keeps the last four digits', () => {
    expect(maskAccountNumber('70001234821')).toMatch(/4821$/);
    expect(maskAccountNumber('70001234821')).not.toContain('7000');
  });

  it('masks a short number entirely rather than exposing most of it', () => {
    expect(maskAccountNumber('123')).toBe('•••');
  });
});
