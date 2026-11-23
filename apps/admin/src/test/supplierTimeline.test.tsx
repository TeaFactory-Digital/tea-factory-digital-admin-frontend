/**
 * The supplier timeline (24 November 2026): bills, requests, change requests and inquiries
 * in one list, newest first, grouped by month, each a link, narrowed by a filter.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminCreditRequest, AdminInquiry, SupplierMonthSummary } from '@tfd/domain';
import { SupplierTimeline } from '@/modules/suppliers/SupplierTimeline';
import { billMoment, buildTimeline, groupByMonth } from '@/modules/suppliers/timeline';
import { renderWithProviders, signInAs, signOut } from './render';

const MANAGER = 'manager@galabodatea.lk';

const month = (monthKey: string, totalKgs = 100): SupplierMonthSummary => ({
  monthKey,
  billId: `bill-${monthKey}`,
  totalKgs,
  auctionResultAvailable: true,
  grossAmount: 1000,
  finalBalance: 900,
});

const credit = (id: string, supplierId: string, createdAt: string) =>
  ({ id, supplierId, createdAt, facility: 'advance', amount: 5000, status: 'pending', decision: null }) as unknown as AdminCreditRequest;

const inquiry = (id: string, createdAt: string) =>
  ({ id, supplierId: 'sup-1', createdAt, subject: 'Rate', status: 'open' }) as unknown as AdminInquiry;

describe('building the timeline', () => {
  it('puts a month’s bill at the start of the next month, never at a made-up time of day', () => {
    expect(billMoment('2026-09')).toBe('2026-10-01T00:00:00.000Z');
    expect(billMoment('2026-12')).toBe('2027-01-01T00:00:00.000Z');
  });

  it('merges every kind newest first, and drops another supplier’s rows', () => {
    const events = buildTimeline({
      supplierId: 'sup-1',
      months: [month('2026-09'), month('2026-08', 0)],
      credit: [credit('c1', 'sup-1', '2026-10-05T04:00:00.000Z'), credit('c2', 'sup-2', '2026-10-06T04:00:00.000Z')],
      inquiries: [inquiry('i1', '2026-09-20T04:00:00.000Z')],
    });
    expect(events.map((event) => event.id)).toEqual(['credit-c1', 'bill-2026-09', 'inquiry-i1', 'bill-2026-08']);
  });

  it('heads each month with its bill, then that month’s other events', () => {
    const groups = groupByMonth(
      buildTimeline({
        supplierId: 'sup-1',
        months: [month('2026-09')],
        inquiries: [inquiry('i1', '2026-09-20T04:00:00.000Z')],
        credit: [credit('c1', 'sup-1', '2026-10-05T04:00:00.000Z')],
      }),
    );
    expect(groups.map((group) => group.monthKey)).toEqual(['2026-10', '2026-09']);
    expect(groups[1]!.events.map((event) => event.id)).toEqual(['bill-2026-09', 'inquiry-i1']);
  });

  it('shows a row that came from two status pages once', () => {
    const one = credit('c1', 'sup-1', '2026-10-05T04:00:00.000Z');
    expect(buildTimeline({ supplierId: 'sup-1', credit: [one, one] })).toHaveLength(1);
  });
});

describe('the timeline tab', () => {
  beforeEach(() => signOut());

  it('lists bills and requests, links each, and narrows to one kind', async () => {
    const user = userEvent.setup();
    await signInAs(MANAGER);
    renderWithProviders(<SupplierTimeline supplierId="sup-1" />);

    const bill = await screen.findAllByRole('link', { name: /Bill for/ });
    expect(bill[0]).toHaveAttribute('href', expect.stringMatching(/^\/bills\//));
    const request = (await screen.findAllByRole('link', { name: /request/ }))[0]!;
    expect(request.getAttribute('href')).toMatch(/^\/credit\//);

    const filters = screen.getByRole('group', { name: 'Show' });
    await user.click(within(filters).getByRole('button', { name: /^Bills/ }));
    expect(within(filters).getByRole('button', { name: /^Bills/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByRole('link', { name: /request/ })).toHaveLength(0);
    expect(screen.getAllByRole('link', { name: /Bill for/ }).length).toBeGreaterThan(0);
  });
});
