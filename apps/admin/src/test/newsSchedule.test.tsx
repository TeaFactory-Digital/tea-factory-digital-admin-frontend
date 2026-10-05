import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminNewsArticle } from '@tfd/domain';
import { ScheduleControl } from '@/modules/news/ScheduleControl';
import { colomboLocalToInstant } from '@/lib/colombo';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('scheduling a news article', () => {
  it('reads the picked time as Colombo time', () => {
    expect(colomboLocalToInstant('2026-10-06T08:00')).toBe('2026-10-06T08:00:00+05:30');
    expect(new Date(colomboLocalToInstant('2026-10-06T08:00')).toISOString()).toBe(
      '2026-10-06T02:30:00.000Z',
    );
  });

  it('shows when a scheduled draft will publish, with a way to cancel', async () => {
    await signInAs('factoryadmin@galabodatea.lk');
    const article = {
      id: 'news-1',
      status: 'draft',
      scheduledPublishAt: '2026-12-01T02:30:00.000Z',
    } as AdminNewsArticle;
    renderWithProviders(<ScheduleControl article={article} />);
    expect(screen.getByText(/publishes itself on/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel schedule/i })).toBeInTheDocument();
  });

  it('offers nothing on an article that is already published', async () => {
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(
      <ScheduleControl article={{ id: 'n', status: 'published' } as AdminNewsArticle} />,
    );
    expect(screen.queryByRole('button', { name: /schedule/i })).not.toBeInTheDocument();
  });

  it('opens the picker and keeps Schedule disabled until a time is picked', async () => {
    const user = userEvent.setup();
    await signInAs('factoryadmin@galabodatea.lk');
    renderWithProviders(
      <ScheduleControl article={{ id: 'n', status: 'draft' } as AdminNewsArticle} />,
    );
    await user.click(screen.getByRole('button', { name: /schedule…/i }));
    expect(screen.getByRole('button', { name: /^schedule$/i })).toBeDisabled();
  });
});
