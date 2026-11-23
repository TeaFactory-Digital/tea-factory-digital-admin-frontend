/**
 * "Your work today" (24 November 2026): where to start, overdue first, only the queues this
 * role can decide, each row a link into its queue.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { QueueCount } from '@tfd/domain';
import { TodayCard } from '@/modules/dashboard/TodayCard';
import { queueLink, todayItems } from '@/modules/dashboard/today';
import { renderWithProviders, signInAs, signOut } from './render';

const q = (queue: QueueCount['queue'], pending: number, breachingSla: number, oldestPendingAt: string | null = null) =>
  ({ queue, pending, breachingSla, oldestPendingAt }) as QueueCount;

describe('what to do first', () => {
  it('puts overdue first (most first), then assigned, then waiting (oldest first)', () => {
    const items = todayItems(
      [
        q('inquiries', 4, 0, '2026-11-20T00:00:00.000Z'),
        q('changeRequests', 10, 3, '2026-11-15T00:00:00.000Z'),
        q('loanRequests', 2, 1, '2026-11-18T00:00:00.000Z'),
        q('teaPacketRequests', 0, 0),
      ],
      () => true,
      2,
    );
    expect(items.map((item) => `${item.kind}:${'queue' in item ? item.queue.queue : 'me'}:${item.count}`)).toEqual([
      'overdue:changeRequests:3',
      'overdue:loanRequests:1',
      'assigned:me:2',
      'waiting:changeRequests:7',
      'waiting:loanRequests:1',
      'waiting:inquiries:4',
    ]);
  });

  it('leaves out the queues this role cannot decide', () => {
    const items = todayItems([q('loanRequests', 2, 1), q('inquiries', 1, 0)], (one) => one.queue === 'inquiries');
    expect(items.map((item) => ('queue' in item ? item.queue.queue : 'me'))).toEqual(['inquiries']);
  });

  it('opens a credit facility narrowed to it, the way the queue cards do', () => {
    expect(queueLink('loanRequests')).toBe('/credit?status=pending&facility=loan');
    expect(queueLink('inquiries')).toBe('/inquiries?status=pending');
  });
});

describe('the card', () => {
  beforeEach(() => signOut());

  it('offers a clerk only their own queues, the first row as the place to start', async () => {
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(
      <TodayCard queues={[q('loanRequests', 2, 1), q('changeRequests', 5, 2, '2026-11-15T00:00:00.000Z')]} />,
    );
    const card = (await screen.findByRole('heading', { name: 'Your work today' })).closest('section')!;
    const links = within(card).getAllByRole('link');
    expect(links[0]).toHaveTextContent('2 past the target in Change requests');
    expect(links[0]).toHaveTextContent('Start here');
    expect(links[0]).toHaveAttribute('href', '/change-requests?status=pending');
    // The clerk decides no loans.
    expect(within(card).queryByText(/Loans/)).not.toBeInTheDocument();
  });

  it('says so when nothing is waiting', async () => {
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<TodayCard queues={[q('changeRequests', 0, 0)]} />);
    expect(await screen.findByText('Nothing is waiting for you. All clear.')).toBeInTheDocument();
  });
});
