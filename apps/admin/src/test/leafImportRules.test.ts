/**
 * The leaf and rate imports as the API checks them (#45 step 3, ADR-040, R23 to R26):
 * no 0 kg, no more than 5,000 kg, no rate of 0, no day after today; exception ids are
 * `<type>:<entityId>` and travel URL-encoded.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { importRowProblems } from '@tfd/domain';
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
