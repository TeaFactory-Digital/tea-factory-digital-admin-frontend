/**
 * The audit log kept to the point (24 November 2026): a long text shows only what changed,
 * more than three fields fold away, and a record type reads as words in every language.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { AuditDetails } from '@/components/AuditDetails';
import { AUDIT_ENTITIES, auditEntityLabel } from '@/lib/auditLabels';
import { changeExcerpt } from '@/lib/textChange';
import { en } from '@/i18n/locales/en';
import { si } from '@/i18n/locales/si';
import { ta } from '@/i18n/locales/ta';

const PAGE = '## When is my monthly bill available? Bills are usually ready within the first two weeks of the following month. ## How do I read the daily supply table? Each numbered day shows the kilograms.';

describe('the part of a long text that changed', () => {
  it('trims the common start and end, keeping a little context', () => {
    const excerpt = changeExcerpt(`1 ${PAGE}`, PAGE);
    expect(excerpt.removed).toBe('1 ');
    expect(excerpt.added).toBe('');
    expect(excerpt.leading).toBe('');
    expect(excerpt.cutStart).toBe(false);
    expect(excerpt.trailing.length).toBeLessThanOrEqual(40);
    expect(excerpt.cutEnd).toBe(true);
  });

  it('finds a change in the middle', () => {
    const excerpt = changeExcerpt(PAGE, PAGE.replace('two weeks', 'ten days'));
    expect(excerpt.removed).toBe('two weeks');
    expect(excerpt.added).toBe('ten days');
    expect(excerpt.leading.endsWith('within the first ')).toBe(true);
    expect(excerpt.cutStart).toBe(true);
  });
});

describe('the change column', () => {
  it('shows a long text as its change, with the full text one click away', async () => {
    const user = userEvent.setup();
    render(<AuditDetails before={{ body: `1 ${PAGE}` }} after={{ body: PAGE }} />);
    expect(screen.getByText('1', { exact: false, selector: 'del' })).toBeInTheDocument();
    // Not the whole page twice.
    expect(screen.queryByText(PAGE)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show full text' }));
    expect(screen.getByText(PAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide full text' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('folds more than three fields behind "+N more"', async () => {
    const user = userEvent.setup();
    render(
      <AuditDetails
        before={{ name: 'A', email: 'a@x.lk', note: 'one', reason: 'r1', subject: 's1' }}
        after={{ name: 'B', email: 'b@x.lk', note: 'two', reason: 'r2', subject: 's2' }}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: '+2 more' }));
    expect(screen.getAllByRole('term')).toHaveLength(5);
  });
});

describe('record type names', () => {
  it('has a name for every record type in all three languages', () => {
    for (const entity of AUDIT_ENTITIES) {
      for (const table of [en, si, ta] as Record<string, string>[]) {
        expect(table[`audit.entity.${entity}`], entity).toBeTruthy();
      }
    }
  });

  it('reads an unknown type as words, never as code', () => {
    const t = i18next.t.bind(i18next) as unknown as (key: string, options?: { defaultValue?: string }) => string;
    expect(auditEntityLabel('staticPage', t)).toBe('Fixed page');
    expect(auditEntityLabel('somethingBrandNew', t)).toBe('Something brand new');
  });
});
