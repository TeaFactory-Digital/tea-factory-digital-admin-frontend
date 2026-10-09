/**
 * The notification bell: what is waiting, and what suppliers just did (`activity.ts`).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activityRepository } from '@/services/repositories/activityRepository';
import { NotificationBell } from '@/layout/NotificationBell';
import type { DashboardView } from '@/services/repositories/dashboardRepository';
import { renderWithProviders, signInAs, signOut } from './render';

const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const EDITOR = 'editor@galabodatea.lk';

beforeEach(() => signOut());

describe('the activity feed', () => {
  it('lists supplier actions newest first, and only what the user may open', async () => {
    await signInAs(MANAGER);
    const feed = (await activityRepository.feed(100))!;
    expect(feed.items.length).toBeGreaterThan(0);
    const times = feed.items.map((one) => one.at);
    expect([...times].sort().reverse()).toEqual(times);
    expect(feed.items.some((one) => one.kind === 'creditRequest.created')).toBe(true);

    // The content editor has no credit queue, so is never told about a loan request.
    await signInAs(EDITOR);
    const editors = (await activityRepository.feed(100))!;
    expect(editors.items.some((one) => one.kind.startsWith('creditRequest'))).toBe(false);
  });

  it('marks it read for this user only', async () => {
    await signInAs(MANAGER);
    const before = (await activityRepository.feed())!;
    expect(before.unread).toBeGreaterThan(0);
    await activityRepository.markRead(before.items[0]!.at);
    const after = (await activityRepository.feed())!;
    expect(after.unread).toBe(0);
    expect(after.items.every((one) => !one.unread)).toBe(true);

    // The clerk's bell is untouched by the manager reading theirs.
    await signInAs(CLERK);
    expect((await activityRepository.feed())!.unread).toBeGreaterThan(0);
  });
});

describe('the bell', () => {
  const summary = {
    queues: [
      { queue: 'loanRequests', pending: 3, oldestPendingAt: new Date(Date.now() - 80 * 3_600_000).toISOString(), breachingSla: 1 },
      { queue: 'inquiries', pending: 0, oldestPendingAt: null, breachingSla: 0 },
    ],
  } as unknown as DashboardView;

  it('opens on the waiting queues and the recent supplier activity', async () => {
    await signInAs(CLERK);
    renderWithProviders(<NotificationBell summary={summary} />);

    const bell = await screen.findByRole('button', { name: /Notifications, \d+ new/ });
    await userEvent.click(bell);

    expect(await screen.findByText('Waiting for you')).toBeInTheDocument();
    // Only the queue with something in it, linked into the narrowed queue.
    expect(screen.getByRole('link', { name: /Loans/ })).toHaveAttribute(
      'href',
      '/credit?status=pending&facility=loan',
    );
    expect(screen.queryByText('Inquiries', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByLabelText('Not read yet').length).toBeGreaterThan(0));
  });
});
