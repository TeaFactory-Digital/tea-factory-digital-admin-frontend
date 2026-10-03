/**
 * A field's text hint sits behind an "i"; a hint that is not plain text stays visible.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, Input } from '@/components/ui/Field';

const LONG =
  'A stock limit, not a credit limit. The factory allows this many packets per supplier per calendar month.';

function renderField(hint: string) {
  render(
    <Field label="Packets per month" hint={hint}>
      {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} />}
    </Field>,
  );
}

describe('Field hint', () => {
  it('keeps a non-text hint visible under the field', () => {
    render(
      <Field label="Packets per month" hint={<span>Live value: 12</span>}>
        {({ id }) => <Input id={id} />}
      </Field>,
    );
    expect(screen.getByText('Live value: 12').parentElement).not.toHaveClass('sr-only');
    expect(screen.queryByRole('button', { name: 'More information' })).not.toBeInTheDocument();
  });

  it('puts a text hint behind an "i", still describing the input for screen readers', () => {
    renderField(LONG);
    expect(screen.getByRole('button', { name: 'More information' })).toBeInTheDocument();
    expect(screen.getByText(LONG)).toHaveClass('sr-only');
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(LONG);
  });
});
