/** Office hours: a week of times ⇄ the one line of text the app prints. */

import { describe, expect, it } from 'vitest';
import {
  defaultWeek,
  formatOfficeHours,
  officeHoursProblems,
  parseOfficeHours,
} from '@/lib/officeHours';

describe('office hours', () => {
  it('groups consecutive days with the same hours', () => {
    expect(formatOfficeHours(defaultWeek())).toBe('Mon–Fri 08:00–17:00; Sat 08:00–12:00');
  });

  it('reads back exactly what it wrote', () => {
    const week = defaultWeek();
    week.Wed = { open: false, from: '08:00', to: '17:00' };
    week.Sun = { open: true, from: '09:00', to: '11:30' };
    const text = formatOfficeHours(week);
    expect(text).toBe('Mon–Tue 08:00–17:00; Thu–Fri 08:00–17:00; Sat 08:00–12:00; Sun 09:00–11:30');
    expect(formatOfficeHours(parseOfficeHours(text)!)).toBe(text);
  });

  it('leaves older free text alone rather than guessing', () => {
    expect(parseOfficeHours('Mon–Sat, 8am–5pm')).toBeNull();
    expect(parseOfficeHours('')).toBeNull();
  });

  it('flags a day that closes before it opens', () => {
    const week = defaultWeek();
    week.Mon = { open: true, from: '17:00', to: '08:00' };
    expect(officeHoursProblems(week)).toEqual(['Mon']);
  });
});
