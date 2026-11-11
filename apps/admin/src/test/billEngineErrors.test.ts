/**
 * The bill engine's refusals (backend 221a1c0, T14 in its upstream-tickets.md): each has its
 * own text, and the values it names reach the message. Every key is checked in all three
 * languages, so none of them falls back to "Unexpected error".
 */

import { describe, expect, it } from 'vitest';
import { errorMessageKey, errorMessageValues } from '@/lib/errorMessage';
import { ApiError } from '@/services/api/errors';
import { en } from '@/i18n/locales/en';
import { si } from '@/i18n/locales/si';
import { ta } from '@/i18n/locales/ta';

const refusal = (code: string, details?: unknown) =>
  new ApiError({ code, status: 409, message: 'Refused.', details });

const CASES: Array<[ApiError, string, Record<string, string>]> = [
  [refusal('month-not-ended', { monthKey: '2026-11' }), 'error.monthNotEnded', { month: '2026-11' }],
  [refusal('cut-over-month', { reason: 'required' }), 'error.cutOverMonth.required', {}],
  [refusal('month-locked', { monthKey: '2026-08', reason: 'behind' }), 'error.monthLocked.behind', { month: '2026-08' }],
  [
    refusal('bill-source-blocked', { reason: 'payment-corrections-pending', count: 3 }),
    'error.billSourceBlocked.correctionsPending',
    { count: '3' },
  ],
  [
    refusal('bills-stale', { suppliers: ['5708', '0123'], count: 2, reason: 'figures' }),
    'error.billsStale.figures',
    { suppliers: '5708, 0123', count: '2' },
  ],
  [refusal('earlier-month-unpublished', { monthKey: '2026-09' }), 'error.earlierMonthUnpublished', { month: '2026-09' }],
];

describe('the bill engine refusals', () => {
  it.each(CASES.map(([error, key, values]) => [key, error, values] as const))('gives %s its text', (key, error, values) => {
    expect(errorMessageKey(error)).toBe(key);
    expect(errorMessageValues(error)).toMatchObject(values);
    for (const locale of [en, si, ta] as Array<Record<string, string>>) {
      expect(locale[key], key).toBeTruthy();
    }
  });

  it('keeps the old texts for the old reasons', () => {
    expect(errorMessageKey(refusal('month-locked', { monthKey: '2026-08' }))).toBe('error.monthLocked');
    expect(errorMessageKey(refusal('bills-stale'))).toBe('error.billsStale');
    expect(errorMessageKey(refusal('bill-source-blocked', { months: ['2026-10'] }))).toBe('error.billSourceBlocked');
  });
});
