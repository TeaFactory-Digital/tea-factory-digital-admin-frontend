/**
 * The shadcn-style filter dropdown: it opens as a popup list, reports `null` for "all",
 * and never hands Radix the empty string it refuses.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterSelect } from '@/components/ui/SelectMenu';

// jsdom has no pointer capture or scrolling, both of which Radix Select calls on open.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

describe('FilterSelect', () => {
  it('shows the "all" label when nothing is chosen, and opens a list on click', async () => {
    const onChange = vi.fn();
    render(
      <FilterSelect
        label="Status"
        allLabel="All statuses"
        options={OPTIONS}
        value={null}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Status' });
    expect(trigger).toHaveTextContent('All statuses');

    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole('option', { name: 'Suspended' }));
    expect(onChange).toHaveBeenCalledWith('suspended');
  });

  it('turns choosing "all" back into null for the URL', async () => {
    const onChange = vi.fn();
    render(
      <FilterSelect
        label="Status"
        allLabel="All statuses"
        options={OPTIONS}
        value="active"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Active');
    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'All statuses' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
