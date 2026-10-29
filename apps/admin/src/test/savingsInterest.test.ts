/**
 * Savings interest, as the factory decided it on 29 October 2026: **simple**, on each
 * month's **lowest balance**, credited **once a year with the month before the withdrawal
 * month**. The figures are the worked examples the decision was taken on, 6% a year.
 */
import { describe, expect, it } from 'vitest';
import { interestYear, savingsInterestFor, type SavingsInterestEntry } from '@tfd/domain';

const entry = (monthKey: string, amount: number, source?: SavingsInterestEntry['source']) => ({
  monthKey,
  amount,
  source,
});

describe('interestYear: the twelve months, credited before the window', () => {
  it('runs April to March for an April window', () => {
    expect(interestYear({ withdrawalMonth: 4 }, 2027)).toEqual({ fromMonthKey: '2026-04', toMonthKey: '2027-03' });
  });

  it('crosses the year for a January window', () => {
    expect(interestYear({ withdrawalMonth: 1 }, 2027)).toEqual({ fromMonthKey: '2026-01', toMonthKey: '2026-12' });
  });
});

describe('savingsInterestFor', () => {
  const year = { fromMonthKey: '2026-04', toMonthKey: '2027-03' };

  it('pays the opening balance in an ordinary month: this month’s savings earn from next month', () => {
    const result = savingsInterestFor([entry('2026-03', 20000), entry('2026-04', 2000)], year, 6);
    expect(result.months[0]).toMatchObject({ opening: 20000, closing: 22000, base: 20000, interest: 100 });
    expect(result.months[1]).toMatchObject({ opening: 22000, base: 22000, interest: 110 });
  });

  it('pays the balance after a withdrawal in the month it is paid', () => {
    // 20,000 held, 15,000 taken out and 2,000 saved on the April bill: 7,000 after.
    const result = savingsInterestFor(
      [entry('2026-03', 20000), entry('2026-04', 2000), entry('2026-04', -15000, 'withdrawal')],
      year,
      6,
    );
    expect(result.months[0]).toMatchObject({ opening: 20000, closing: 7000, base: 7000, interest: 35 });
  });

  it('is simple: 20,000 all year at 6% is 1,200, not the 1,233.56 monthly crediting would pay', () => {
    const result = savingsInterestFor([entry('2026-03', 20000)], year, 6);
    expect(result.months).toHaveLength(12);
    expect(result.total).toBe(1200);
  });

  it('earns nothing before the first entry, and nothing on a balance below zero', () => {
    const result = savingsInterestFor([entry('2026-10', 5000), entry('2026-11', -6000, 'adjustment')], year, 6);
    expect(result.months.slice(0, 7).every((one) => one.interest === 0)).toBe(true);
    expect(result.months[7]).toMatchObject({ monthKey: '2026-11', opening: 5000, base: 0, interest: 0 });
  });

  it('counts last year’s credited interest as balance, and gives the same answer once this year’s is posted', () => {
    const entries = [entry('2026-03', 20000), entry('2026-03', 1200, 'interest')];
    const before = savingsInterestFor(entries, year, 6);
    expect(before.months[0]?.base).toBe(21200);
    const after = savingsInterestFor([...entries, entry('2027-03', before.total, 'interest')], year, 6);
    expect(after.total).toBe(before.total);
  });

  it('applies the rate in force each month when the factory changed it during the year', () => {
    const result = savingsInterestFor([entry('2026-03', 12000)], year, (monthKey) => (monthKey < '2026-10' ? 6 : 3));
    // Six months at 60 and six at 30.
    expect(result.total).toBe(540);
  });

  it('rounds each month to the cent, and the total is their sum', () => {
    const result = savingsInterestFor([entry('2026-03', 1234.56)], year, 5);
    expect(result.months[0]?.interest).toBe(5.14);
    expect(result.total).toBe(61.68);
  });

  it('pays nothing at the default 0%', () => {
    expect(savingsInterestFor([entry('2026-03', 20000)], year, 0).total).toBe(0);
  });
});
