/**
 * The status pill sizes to its text, wherever it is put.
 *
 * `inline-flex` already does that on its own, which is why this looked settled. But a
 * badge is very often the first child of a `flex flex-col` cell — a status stacked over
 * the date it happened, in six grids at the last count — and a **column flex container
 * stretches its children to its full width by default**. So every "Signed in" in the
 * supplier register rendered as a pale green bar the width of the column, which reads as
 * a filled progress track rather than as a status. The shorter the label, the worse it
 * looked: "Signed in" and "Never installed" came out identical widths.
 *
 * Nothing else in the suite can see this. It is not a wrong element, a wrong string or a
 * wrong role — the markup is correct and only the geometry is wrong, so it is invisible
 * to every query in `@testing-library` and to the typechecker alike. It reached a
 * reviewer's eye instead.
 *
 * jsdom computes no layout, so these assert the *rule* rather than a measured width. That
 * is the honest limit of the test: it pins the decision and its reason, and would fail the
 * day somebody tidies `w-fit` away as redundant — which it looks, right up until the badge
 * is put in a column.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, CountBadge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('keeps a definite width, so a column flex parent cannot stretch it', () => {
    render(<Badge tone="success">Signed in</Badge>);

    /**
     * `align-self: stretch` is what a `flex flex-col` cell applies, and a definite width
     * is what overrides it. Asserted as the class because jsdom lays nothing out.
     */
    expect(screen.getByText('Signed in')).toHaveClass('w-fit');
  });

  it('is fixed for every tone, not just the one that was reported', () => {
    // The supplier register showed it on `success`; the same cell renders `neutral` for
    // "Never installed", and four other grids use the remaining tones.
    const { container } = render(
      <>
        <Badge tone="neutral">Never installed</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="error">Error</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="primary">Primary</Badge>
      </>,
    );

    for (const pill of container.querySelectorAll('span')) {
      expect(pill).toHaveClass('w-fit');
    }
  });

  it('still lets a count reserve its minimum width', () => {
    render(<CountBadge count={7} />);

    /**
     * The one badge that is deliberately wider than its text: a single digit in a
     * `min-w-6` pill so that 7 and 70 do not jitter the sidebar as a queue drains.
     * `min-width` outranks `width`, so the two coexist — but only while both are present,
     * and `cn` does not merge conflicting classes (see `lib/cn`).
     */
    const pill = screen.getByText('7');
    expect(pill).toHaveClass('min-w-6');
    expect(pill).toHaveClass('w-fit');
  });

  it('renders nothing for an empty queue rather than a zero', () => {
    // Unrelated to the width, and the reason `CountBadge` cannot simply be a `Badge`:
    // a grey `0` beside every drained queue is noise the eye learns to skip.
    const { container } = render(<CountBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
