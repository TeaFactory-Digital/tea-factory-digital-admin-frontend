/**
 * The date controls that replaced the browser's own.
 *
 * A native `type="date"` was doing two jobs correctly for free — parsing what was typed,
 * and keeping the value in the browser's calendar rather than in UTC. Replacing it for
 * theming reasons means taking both jobs on, and the second is the one with teeth: the
 * console carries dates as Colombo-local `YYYY-MM-DD` strings because a delivery belongs
 * to the day the leaf was weighed (BR-104), and `new Date('2026-08-09')` parses as *UTC*
 * midnight — the evening of the 8th for any browser west of Greenwich.
 *
 * That failure is invisible in Colombo, where this is developed, and shows up as a
 * morning's weighing filed under yesterday on a laptop somebody never changed the
 * timezone on.
 */

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { fromLocalDate, toLocalDate } from '@/lib/localDate';
import { DatePicker, DateTimePicker } from '@/components/ui/DatePicker';
import { renderWithProviders } from './render';

describe('localDate', () => {
  it('survives a round trip', () => {
    expect(fromLocalDate(toLocalDate('2026-08-09'))).toBe('2026-08-09');
    expect(fromLocalDate(toLocalDate('2026-01-01'))).toBe('2026-01-01');
    expect(fromLocalDate(toLocalDate('2026-12-31'))).toBe('2026-12-31');
  });

  it('lands at noon, so no offset can move the day', () => {
    /**
     * The whole reason this helper exists rather than `new Date(value)`. Midnight minus
     * any offset in use anywhere is the previous day; noon has twelve hours of clearance
     * on either side.
     */
    expect(toLocalDate('2026-08-09')?.getHours()).toBe(12);
    expect(toLocalDate('2026-08-09')?.getDate()).toBe(9);
    expect(toLocalDate('2026-08-09')?.getMonth()).toBe(7);
  });

  it('reads a half-typed value as nothing chosen, not as a date nobody entered', () => {
    /**
     * `new Date(2026, 1, 31)` rolls silently forward to 3 March. The field is typeable, so
     * every prefix of a real date passes through here on the way — and a calendar that
     * jumped to March while somebody was still typing February would be unusable.
     */
    expect(toLocalDate('2026-02-31')).toBeUndefined();
    expect(toLocalDate('2026-13-01')).toBeUndefined();
    expect(toLocalDate('2026-08')).toBeUndefined();
    expect(toLocalDate('')).toBeUndefined();
    expect(toLocalDate(null)).toBeUndefined();
  });
});

function DateHarness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DatePicker value={value} onChange={setValue} aria-label="Date" />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('DatePicker', () => {
  it('still takes a typed date, which is the fast path', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateHarness />);

    /**
     * Kept deliberately. A clerk entering a week of back-dated sheets types the date far
     * faster than they can click a grid, so a control that only opened a calendar would
     * have made the common path slower in exchange for the theming.
     */
    await user.type(within(container).getByLabelText('Date'), '2026-08-09');
    expect(within(container).getByTestId('value')).toHaveTextContent('2026-08-09');
  });

  it('writes back a Colombo-local day when one is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateHarness initial="2026-08-09" />);

    await user.click(within(container).getByRole('button', { name: /calendar/i }));

    // Portalled by Radix, so this one is asked of the document rather than the container.
    // Day buttons are labelled in full — "Friday, August 14th, 2026" — so the visible
    // "14" is not the accessible name.
    const grid = await screen.findByRole('grid');
    await user.click(within(grid).getByRole('button', { name: /August 14th, 2026/ }));

    expect(within(container).getByTestId('value')).toHaveTextContent('2026-08-14');
  });

  it('closes once a day is chosen', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateHarness initial="2026-08-09" />);

    await user.click(within(container).getByRole('button', { name: /calendar/i }));
    const grid = await screen.findByRole('grid');
    await user.click(within(grid).getByRole('button', { name: /August 14th, 2026/ }));

    // A single date is a complete answer; a panel left open covers the field it just
    // filled, so the clerk cannot see what they picked.
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('opens on the month the field already names', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateHarness initial="2025-03-04" />);

    await user.click(within(container).getByRole('button', { name: /calendar/i }));

    // Not the current month: on a back-dated sheet the selection would be off-screen and
    // the clerk would have to page backwards to the month they had already typed.
    expect(await screen.findByText(/March 2025/i)).toBeInTheDocument();
  });
});

function DateTimeHarness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateTimePicker value={value} onChange={setValue} aria-label="Starts" />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('DateTimePicker', () => {
  it('keeps the time when the date changes, and the date when the time changes', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateTimeHarness initial="2026-08-09T14:30" />);
    const view = within(container);

    /**
     * Clearing the date to fix a typo used to throw the **time** away with it, because
     * the time was read back out of a value that had just become `''`. Retyping the date
     * brought the field back at midnight and nothing said so.
     */
    await user.clear(view.getByLabelText('Starts'));
    await user.type(view.getByLabelText('Starts'), '2026-08-20');
    expect(view.getByTestId('value')).toHaveTextContent('2026-08-20T14:30');
  });

  it('defaults a missing time to midnight rather than emitting a broken value', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateTimeHarness />);
    const view = within(container);

    await user.type(view.getByLabelText('Starts'), '2026-08-09');

    /**
     * `2026-08-09T` — a date, the separator, and nothing after it — parses as an invalid
     * date. A banner saved with that never shows, and there is nothing on the screen to
     * say why: the window looks filled in.
     */
    expect(view.getByTestId('value')).toHaveTextContent('2026-08-09T00:00');
  });

  it('clears to empty rather than to a lone time', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateTimeHarness initial="2026-08-09T14:30" />);
    const view = within(container);

    await user.clear(view.getByLabelText('Starts'));

    // `T14:30` with no date is not a shorter answer, it is a different kind of value —
    // and `endsAt` is genuinely optional, so empty has to be reachable.
    expect(view.getByTestId('value')).toHaveTextContent('');
  });
});

/**
 * The time half.
 *
 * Written against a component that shadcn does not have — its registry stops at `Calendar`
 * and `Date Picker`, and its own date-and-time examples are a calendar beside a native
 * `<input type="time">`. So the thing worth pinning is the split decision: the input stays
 * native because it already does segment editing and locale display correctly, while the
 * *affordance* beside it is ours so the pair does not read as two different products.
 */
describe('TimePicker', () => {
  it('keeps a typeable native time field', () => {
    const { container } = renderWithProviders(<DateTimeHarness initial="2026-08-09T14:30" />);
    const view = within(container);

    const field = view.getByLabelText('Time');
    // Native, deliberately: arrow-key editing per segment and 12/24-hour display by locale
    // are both free here and would have to be rebuilt otherwise.
    expect(field).toHaveAttribute('type', 'time');

    /**
     * `fireEvent.change` rather than `user.type`, because a time input is **segmented** —
     * keystrokes land in the hour box, then the minute box, and the browser assembles the
     * value. Typing "09:15" through it yields `00:59`, which says nothing about this
     * component and everything about how the control consumes keys.
     */
    fireEvent.change(field, { target: { value: '09:15' } });
    expect(view.getByTestId('value')).toHaveTextContent('2026-08-09T09:15');
  });

  it('offers half-hourly slots and writes the one clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateTimeHarness initial="2026-08-09T14:30" />);

    await user.click(within(container).getByRole('button', { name: /choose a time/i }));

    const list = await screen.findByRole('listbox');
    await user.click(within(list).getByRole('option', { name: '18:00' }));

    expect(within(container).getByTestId('value')).toHaveTextContent('2026-08-09T18:00');
  });

  it('marks the current value in the list', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DateTimeHarness initial="2026-08-09T14:30" />);

    await user.click(within(container).getByRole('button', { name: /choose a time/i }));
    const list = await screen.findByRole('listbox');

    /**
     * Without this the list opens at midnight with nothing selected, and an 18:00 window
     * is three-quarters of a scroll away every single time it is opened.
     */
    expect(within(list).getByRole('option', { name: '14:30' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // Half-hourly: 48 rows, not 288. These are opening windows, not appointments.
    expect(within(list).getAllByRole('option')).toHaveLength(48);
  });
});
