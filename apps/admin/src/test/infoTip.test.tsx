/**
 * The "i" that holds guidance off the page until it is asked for.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoTip } from '@/components/ui/Tooltip';

describe('InfoTip', () => {
  it('hides its text until hovered, then shows it in a tooltip', async () => {
    render(<InfoTip label="Why?">Only the clerk can do this.</InfoTip>);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', { name: 'Why?' }));
    // Radix renders the text twice (visible and for screen readers); the role is on one.
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Only the clerk can do this.');
  });

  it('opens from the keyboard too', async () => {
    render(<InfoTip label="Why?">Only the clerk can do this.</InfoTip>);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Why?' })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  });
});
