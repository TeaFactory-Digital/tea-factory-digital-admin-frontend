/**
 * Static pages written as points (FAQ, terms, privacy): the stored format, and the editor
 * that adds and deletes them.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pagePointsProblem, parsePagePoints, serializePagePoints } from '@tfd/domain';
import { TranslationEditor } from '@/modules/content/TranslationEditor';

const BODY = [
  'These terms are between you and the factory.',
  '',
  '## When is my bill available?',
  'Within the first two weeks.',
  '',
  '## How do I change my bank?',
  'Under Settings.',
  'It takes effect once approved.',
].join('\n');

const LABELS = {
  title: 'Question',
  body: 'Answer',
  add: 'Add a question',
  item: (n: number) => `Question ${n}`,
};

describe('page points format', () => {
  it('reads an intro and its points, keeping multi-line text', () => {
    expect(parsePagePoints(BODY)).toEqual({
      intro: 'These terms are between you and the factory.',
      points: [
        { title: 'When is my bill available?', body: 'Within the first two weeks.' },
        {
          title: 'How do I change my bank?',
          body: 'Under Settings.\nIt takes effect once approved.',
        },
      ],
    });
  });

  it('writes back exactly what it read', () => {
    expect(serializePagePoints(parsePagePoints(BODY))).toBe(BODY);
  });

  it('leaves a plain-text page, with no points, as plain text', () => {
    expect(parsePagePoints('Just a paragraph.\n\nAnd another.')).toEqual({
      intro: 'Just a paragraph.\n\nAnd another.',
      points: [],
    });
  });

  it('refuses a point with a title but no text', () => {
    expect(pagePointsProblem({ intro: '', points: [{ title: 'Q', body: '' }] })).toBe(
      'incomplete-point',
    );
  });
});

describe('the points editor', () => {
  const translation = {
    lang: 'en' as const,
    title: 'FAQ',
    body: BODY,
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedByName: 'Editor',
  };

  function renderEditor(onSave = vi.fn()) {
    render(
      <TranslationEditor
        lang="en"
        translation={translation}
        source={translation}
        withExcerpt={false}
        readOnly={false}
        saving={false}
        onSave={onSave}
        pointLabels={LABELS}
      />,
    );
    return onSave;
  }

  it('deletes a point and saves the page without it', async () => {
    const onSave = renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Question 1' }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const saved = onSave.mock.calls[0]![0].body as string;
    expect(parsePagePoints(saved).points.map((p) => p.title)).toEqual(['How do I change my bank?']);
  });

  it('adds a point, and will not save it half written', async () => {
    const onSave = renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Add a question' }));
    const added = screen.getByText('Question 3').closest('li')!;
    await userEvent.type(
      within(added).getByRole('textbox', { name: /Question/ }),
      'Can I get an advance?',
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

    await userEvent.type(
      within(added).getByRole('textbox', { name: /Answer/ }),
      'Yes, from the app.',
    );
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const saved = parsePagePoints(onSave.mock.calls[0]![0].body as string);
    expect(saved.points[2]).toEqual({ title: 'Can I get an advance?', body: 'Yes, from the app.' });
  });
});
