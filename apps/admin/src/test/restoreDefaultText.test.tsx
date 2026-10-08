/**
 * "Restore default text": fills the form from the server's starting copy, and stores nothing
 * until Save.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContentTranslation } from '@tfd/domain';
import { TranslationEditor } from '@/modules/content/TranslationEditor';

const edited: ContentTranslation = {
  title: 'Our FAQ',
  body: '## Old question\nOld answer.',
  updatedAt: '2026-10-01T08:00:00.000Z',
  updatedByName: 'The Administrator',
} as ContentTranslation;

const LABELS = {
  title: 'Question',
  body: 'Answer',
  add: 'Add a question',
  item: (n: number) => `Question ${n}`,
};

function renderEditor(restore: () => Promise<{ title: string; body: string } | null>) {
  const onSave = vi.fn();
  render(
    <TranslationEditor
      lang="en"
      translation={edited}
      source={edited}
      withExcerpt={false}
      readOnly={false}
      saving={false}
      onSave={onSave}
      pointLabels={LABELS}
      onRestoreDefault={restore}
    />,
  );
  return onSave;
}

describe('restore default text', () => {
  it('fills the form after confirming, and saves only when Save is pressed', async () => {
    const user = userEvent.setup();
    const restore = vi.fn().mockResolvedValue({
      title: 'Frequently asked questions',
      body: '## When is my monthly bill available?\nWithin two weeks.',
    });
    const onSave = renderEditor(restore);

    await user.click(screen.getByRole('button', { name: 'Restore default text' }));
    expect(restore).not.toHaveBeenCalled();
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Restore default text',
      }),
    );

    expect(await screen.findByDisplayValue('Frequently asked questions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('When is my monthly bill available?')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Save/ }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Frequently asked questions',
        body: '## When is my monthly bill available?\nWithin two weeks.',
      }),
    );
  });

  it('leaves the form alone when the server has no default', async () => {
    const user = userEvent.setup();
    renderEditor(vi.fn().mockResolvedValue(null));

    await user.click(screen.getByRole('button', { name: 'Restore default text' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Restore default text',
      }),
    );

    expect(await screen.findByDisplayValue('Our FAQ')).toBeInTheDocument();
  });
});
