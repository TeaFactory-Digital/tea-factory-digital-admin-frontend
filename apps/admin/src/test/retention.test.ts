/** Records are kept five years after their month (Q12), and nothing is past it sooner. */
import { describe, expect, it } from 'vitest';
import { RECORD_RETENTION_YEARS, isPastRetention, retainedThroughMonthKey } from '@tfd/domain';

describe('record retention', () => {
  it('keeps a month five years', () => {
    expect(RECORD_RETENTION_YEARS).toBe(5);
    expect(retainedThroughMonthKey('2026-07')).toBe('2031-07');
    expect(retainedThroughMonthKey('2026-12')).toBe('2031-12');
  });

  it('is past it only after the fifth year', () => {
    expect(isPastRetention('2026-07', '2031-07')).toBe(false);
    expect(isPastRetention('2026-07', '2031-08')).toBe(true);
    expect(isPastRetention('2026-07', '2027-01')).toBe(false);
  });
});
