/**
 * The chevron has to stay on the control.
 *
 * `<Select>` draws its own arrow — the native one is hidden by `appearance-none` so the
 * field can be themed — and positions it absolutely against the wrapper. That is correct
 * only while the wrapper is the same width as the `<select>` inside it.
 *
 * It was not. A `div` is block-level, so `w-auto` filled whatever contained it while the
 * `<select>` shrank to its widest option, and the arrow sat at the right edge of the
 * *container* rather than of the control. In a filter bar this never showed, because a flex
 * item shrinks to fit anyway; it showed in M13's capability matrix, where every cell is a
 * `<td>` far wider than the word "Approve" and each of the forty-five dropdowns had an
 * arrow floating in open space to its right.
 *
 * jsdom lays nothing out, so what is asserted is the rule that decides the geometry rather
 * than the geometry — this is a defect a test can pin but not see.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Select } from '@/components/ui/Select';
import { RoleMatrixView } from '@/modules/users/RoleMatrixView';
import { renderWithProviders, signInAs, signOut } from './render';

const wrapperOf = (el: HTMLElement) => el.parentElement!;

describe('Select', () => {
  it('hugs the control when it is not full width', () => {
    render(
      <Select fullWidth={false} aria-label="Level">
        <option value="approve">Approve</option>
      </Select>,
    );

    const wrapper = wrapperOf(screen.getByLabelText('Level'));
    // Shrink-to-fit, so the absolutely-positioned arrow lands on the field.
    expect(wrapper).toHaveClass('inline-block');
    expect(wrapper).not.toHaveClass('w-auto');
  });

  it('still fills its container by default', () => {
    render(
      <Select aria-label="Level">
        <option value="approve">Approve</option>
      </Select>,
    );

    const wrapper = wrapperOf(screen.getByLabelText('Level'));
    // The common case — a form field that lines up with the inputs above and below it.
    expect(wrapper).toHaveClass('w-full');
    expect(wrapper).not.toHaveClass('inline-block');
  });
});

describe('M13 capability matrix', () => {
  beforeEach(() => {
    signOut();
  });

  it('keeps each cell dropdown the width of its own control', async () => {
    await signInAs('factoryadmin@galabodatea.lk');
    const { container } = renderWithProviders(<RoleMatrixView />, { route: '/users?view=roles' });

    const table = await screen.findByRole('table');
    const selects = within(table).getAllByRole('combobox');

    // The screen that surfaced it: one dropdown per role per capability, every one of them
    // in a table cell much wider than "Approve".
    expect(selects.length).toBeGreaterThan(10);
    for (const select of selects) {
      expect(wrapperOf(select)).toHaveClass('inline-block');
    }
    void container;
  });
});
