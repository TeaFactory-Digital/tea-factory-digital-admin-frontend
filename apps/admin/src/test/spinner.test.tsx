/**
 * The loading indicator.
 *
 * Three things worth a test, because each one fails quietly:
 *
 *  - the standalone spinner announcing itself once, not twice and not never — it
 *    is often the only thing on a loading screen
 *  - the arc taking its colour from the text around it, which is what lets one
 *    piece of artwork sit on a white panel and inside a primary button
 *  - the size *variant* actually changing the size, where a caller-supplied class
 *    silently loses to the default (see `lib/cn` on why `cn` does not merge)
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from '@/components/ui/states';
import { Button } from '@/components/ui/Button';

const arcOf = (container: HTMLElement) => container.querySelector('svg');

describe('Spinner', () => {
  it('announces itself once', () => {
    const { container } = render(<Spinner />);

    // One live region, named — a screen reader on an otherwise empty screen hears
    // "Loading…" rather than silence.
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading…');
    // …and the arc inside it is not a second announcement.
    expect(arcOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the arc in the brand colour and turns it', () => {
    const { container } = render(<Spinner />);
    const arc = arcOf(container)!;

    expect(arc).toHaveAttribute('fill', 'currentColor');
    expect(arc).toHaveClass('text-primary', 'animate-spinner');
  });

  it('takes its size from the variant', () => {
    const { container } = render(<Spinner size="sm" />);

    expect(arcOf(container)).toHaveClass('size-icon-sm');
    expect(arcOf(container)).not.toHaveClass('size-icon-lg');
  });
});

describe('a loading Button', () => {
  it('carries the arc without a second "Loading…" over its own label', () => {
    const { container } = render(
      <Button variant="primary" loading>
        Approve
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Approve' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    // `aria-busy` and the label already say it; a `role="status"` here would
    // interrupt them.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // No colour class: the arc inherits `text-primary-contrast` from the button,
    // where the artwork's own blue would be near-invisible.
    expect(arcOf(container)).not.toHaveClass('text-primary');
  });
});
