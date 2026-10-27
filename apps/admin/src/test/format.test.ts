/**
 * The formatters follow the chrome language: the words and their order move, the digits
 * and their grouping do not (lib/format.ts).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import {
  formatAge,
  formatDate,
  formatDateTime,
  formatKg,
  formatMoney,
  formatMonthKey,
  formatMonthName,
  formatMonthShort,
  NOT_AVAILABLE,
} from '@/lib/format';

// 30 July 2026, 14:05 in Colombo.
const INSTANT = '2026-07-30T08:35:00.000Z';
const NBSP = ' ';

afterEach(async () => {
  await setLanguage('en');
});

describe('formatting in the chrome language', () => {
  it('reads as before in English', async () => {
    await setLanguage('en');
    expect(formatDate(INSTANT)).toBe('30 Jul 2026');
    expect(formatDateTime(INSTANT)).toBe('30 Jul 2026, 14:05');
    expect(formatMonthKey('2026-07')).toBe('July 2026');
    expect(formatMonthName(4)).toBe('April');
    expect(formatMonthShort('2026-09')).toBe('Sep');
    expect(formatMoney(1234567.5)).toBe(`LKR${NBSP}1,234,567.50`);
    expect(formatMoney(-300)).toBe(`-LKR${NBSP}300.00`);
    expect(formatKg(1240.5)).toBe('1,240.50 kg');
    expect(formatAge(0.5)).toBe('< 1 h');
    expect(formatAge(5)).toBe('5 h');
    expect(formatAge(72)).toBe('3 d');
  });

  it('writes the year first in Sinhala, with the modern month names', async () => {
    await setLanguage('si');
    expect(formatDate(INSTANT)).toBe('2026 ජූලි 30');
    expect(formatDateTime(INSTANT)).toBe('2026 ජූලි 30, 14:05');
    expect(formatMonthKey('2026-07')).toBe('2026 ජූලි');
    // Not the traditional names some ICU versions give (`ඇසළ` for July, `දුරුතු` for January).
    expect(formatMonthName(1)).toBe('ජනවාරි');
    expect(formatMoney(1234567.5)).toBe(`රු.${NBSP}1,234,567.50`);
    expect(formatMoney(-300)).toBe(`-රු.${NBSP}300.00`);
    expect(formatKg(1240.5)).toBe('1,240.50 කි.ග්‍රෑ.');
    expect(formatAge(5)).toBe('පැය 5');
    expect(formatAge(72)).toBe('දින 3');
  });

  it('writes the day first in Tamil, and groups money as Sri Lanka does', async () => {
    await setLanguage('ta');
    expect(formatDate(INSTANT)).toBe('30 ஜூலை 2026');
    expect(formatDateTime(INSTANT)).toBe('30 ஜூலை 2026, 14:05');
    expect(formatMonthKey('2026-07')).toBe('ஜூலை 2026');
    expect(formatMonthShort('2026-09')).toBe('செப்.');
    // Thousands, not lakhs (`12,34,567.50`).
    expect(formatMoney(1234567.5)).toBe(`ரூ.${NBSP}1,234,567.50`);
    expect(formatKg(1240.5)).toBe('1,240.50 கிலோ');
  });

  it('keeps `null` a dash in every language (BR-102)', async () => {
    for (const code of ['en', 'si', 'ta'] as const) {
      await setLanguage(code);
      expect(formatMoney(null)).toBe(NOT_AVAILABLE);
      expect(formatDate(null)).toBe(NOT_AVAILABLE);
      expect(formatMonthKey('2026-13')).toBe(NOT_AVAILABLE);
    }
  });
});
