/** Where a month's leaf was weighed (Q13): points by the number of days, from the day grid. */
import { describe, expect, it } from 'vitest';
import { collectionPointDays, fullMonthDays } from '@tfd/domain';

describe('collectionPointDays', () => {
  it('counts days per point, most first, a day at two points counting for both', () => {
    expect(
      collectionPointDays([
        { day: 1, kgs: 20, points: ['MAKADURA'] },
        { day: 2, kgs: 18, points: ['MAKADURA', 'KANDEWATTA'] },
        { day: 3, kgs: null, points: null },
        { day: 4, kgs: 22, points: ['MAKADURA'] },
      ]),
    ).toEqual([
      { point: 'MAKADURA', days: 3 },
      { point: 'KANDEWATTA', days: 1 },
    ]);
  });

  it('says nothing when the source names no point', () => {
    expect(collectionPointDays([{ day: 1, kgs: 20 }, { day: 2, kgs: 18, points: null }])).toEqual([]);
  });
});

describe('fullMonthDays', () => {
  it('draws a bill that sends only the days with leaf as the whole month', () => {
    const days = fullMonthDays('2026-02', [{ day: 3, kgs: 12 }, { day: 14, kgs: 9.5 }]);
    expect(days).toHaveLength(28);
    expect(days[2]).toEqual({ day: 3, kgs: 12 });
    expect(days[0]).toEqual({ day: 1, kgs: null });
  });
});
