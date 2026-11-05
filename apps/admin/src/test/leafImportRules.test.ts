/**
 * The leaf and rate imports as the API checks them (#45 step 3, ADR-040, R23 to R26):
 * no 0 kg, no more than 5,000 kg, no rate of 0, no day after today; exception ids are
 * `<type>:<entityId>` and travel URL-encoded.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LEAF_ENTRY_MAX_AGE_DAYS, colomboDayOf, earliestLeafDay, importRowProblems, leafDateProblem } from '@tfd/domain';
import { deliveryRepository } from '@/services/repositories/deliveryRepository';
import { errorMessageKey, errorMessageValues } from '@/lib/errorMessage';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { monthRepository } from '@/services/repositories/monthRepository';
import { signInAs } from './render';
import { clearFactorySync, setFactorySync } from './factorySync';

afterEach(() => clearFactorySync());

describe('the file checks', () => {
  it('refuses 0 kg and more than 5,000 kg', () => {
    const rows = [
      { date: '2026-10-01', supplierCode: '5147', kg: '0' },
      { date: '2026-10-01', supplierCode: '5147', kg: '5000.5' },
      { date: '2026-10-01', supplierCode: '5147', kg: '24.5' },
    ];
    expect(importRowProblems('deliveries', rows).map((p) => [p.row, p.code])).toEqual([
      [2, 'must-be-positive'],
      [3, 'too-large'],
    ]);
  });

  it('refuses a rate of 0', () => {
    expect(importRowProblems('monthlyRates', [{ month: '2026-09', ratePerKg: '0' }])[0]).toMatchObject({
      column: 'ratePerKg',
      code: 'must-be-positive',
    });
  });
});

describe('the server', () => {
  it('refuses a day after today in a leaf file', async () => {
    await setFactorySync(false);
    await signInAs('clerk@galabodatea.lk');
    const result = await factoryRecordRepository.importRows('deliveries', 'leaf.csv', [
      { date: '2099-01-01', supplierCode: '5147', kg: '20' },
    ]);
    expect(result.problems).toEqual(expect.arrayContaining([expect.objectContaining({ column: 'date', code: 'not-allowed' })]));
  });

  it('names an exception by its cause, and resolves it through the encoded id', async () => {
    await signInAs('factory-system@galabodatea.lk');
    const month = (await monthRepository.list()).items.find((one) => one.open)!;
    const open = (await monthRepository.exceptions(month.monthKey, { resolved: false })).items;
    const first = open[0]!;
    expect(first.id).toBe(`${first.type}:${first.entityId}`);
    const resolved = await monthRepository.resolveException(month.monthKey, first.id, 'Checked against the slip and accepted.');
    expect(resolved.resolvedAt).not.toBeNull();
  });
});

describe('30 days back, no further (the factory, 5 November 2026)', () => {
  it('counts back from today, across a month and a year', () => {
    expect(LEAF_ENTRY_MAX_AGE_DAYS).toBe(30);
    expect(earliestLeafDay('2026-11-05')).toBe('2026-10-06');
    expect(earliestLeafDay('2026-01-10')).toBe('2025-12-11');
    expect(leafDateProblem('2026-10-06', '2026-11-05')).toBeNull();
    expect(leafDateProblem('2026-10-05', '2026-11-05')).toBe('too-old');
    expect(leafDateProblem('2026-11-06', '2026-11-05')).toBe('future');
  });

  it('refuses older leaf in a file, and on the session grid, with its own reason', async () => {
    await setFactorySync(false);
    await signInAs('clerk@galabodatea.lk');
    const today = colomboDayOf(new Date());
    const [year, month, day] = today.split('-').map(Number);
    const old = new Date(Date.UTC(year!, month! - 1, day! - 31)).toISOString().slice(0, 10);

    const result = await factoryRecordRepository.importRows('deliveries', 'leaf.csv', [
      { date: old, supplierCode: '5147', kg: '20' },
    ]);
    expect(result.problems).toEqual(expect.arrayContaining([expect.objectContaining({ column: 'date', code: 'too-old' })]));

    await signInAs('factory-system@galabodatea.lk');
    const refusal = await deliveryRepository
      .commit({ date: old, collectionPoint: 'MAKADURA', batchId: 'test-too-old', rows: [{ supplierId: 'sup-1', kgs: 20 }] })
      .catch((error: unknown) => error);
    expect(refusal).toMatchObject({ code: 'invalid', details: { field: 'date', reason: 'too-old' } });
    expect(errorMessageKey(refusal)).toBe('error.leafTooOld');
    expect(errorMessageValues(refusal)).toMatchObject({ days: '30' });
  });
});
