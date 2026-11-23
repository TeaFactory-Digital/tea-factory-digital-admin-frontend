/**
 * The bills list beside last month (24 November 2026): each supplier's kilos against the
 * month before, a big change marked, a supplier with no bill last month called new.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { BillsScreen } from '@/modules/bills/BillsScreen';
import { BIG_CHANGE, kgChange, previousMonthKey } from '@/modules/bills/lastMonth';
import { billRepository } from '@/services/repositories/billRepository';
import { renderWithProviders, signInAs, signOut } from './render';

describe('the rules', () => {
  it('steps back a month, across a year', () => {
    expect(previousMonthKey('2026-10')).toBe('2026-09');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });

  it('calls a supplier with no bill last month new, not +100%', () => {
    expect(kgChange(500, undefined)).toEqual({ kind: 'new' });
    expect(kgChange(500, 0)).toEqual({ kind: 'new' });
    expect(kgChange(0, 0)).toEqual({ kind: 'none' });
  });

  it('marks a change of 30% or more either way', () => {
    expect(BIG_CHANGE).toBe(0.3);
    expect(kgChange(60, 100)).toMatchObject({ kind: 'change', big: true });
    expect(kgChange(130, 100)).toMatchObject({ kind: 'change', big: true });
    expect(kgChange(90, 100)).toMatchObject({ kind: 'change', big: false });
  });
});

describe('the column', () => {
  beforeEach(() => signOut());

  it('shows each row against the month before', async () => {
    await signInAs('manager@galabodatea.lk');
    const months = await billRepository.months();
    const [newer, older] = months.filter((one) => !one.open && one.billCount > 0);
    expect(older?.monthKey).toBe(previousMonthKey(newer!.monthKey));

    renderWithProviders(
      <Routes>
        <Route path="/bills" element={<BillsScreen />} />
      </Routes>,
      { route: `/bills?month=${newer!.monthKey}` },
    );

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Kilos vs/ })).toBeInTheDocument();
    // Every row has last month's figure to compare with in the fixture.
    const changes = await within(table).findAllByText(/\d+%/);
    expect(changes.length).toBeGreaterThan(0);
  });
});
