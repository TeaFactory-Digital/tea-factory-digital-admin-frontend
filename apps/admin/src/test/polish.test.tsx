/**
 * Small things that tell the clerk what is going on (26 November 2026): how late a request
 * is, that the connection dropped and came back, why a screen failed, which rows are new
 * and which just left, where the first mistake in a form is, that a copy landed, and that
 * something is loading rather than empty.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import type { Paged } from '@tfd/domain';
import { AgeBadge } from '@/components/ui/AgeBadge';
import { CopyButton } from '@/components/ui/CopyButton';
import { DataTable } from '@/components/ui/DataTable';
import { Field, Input } from '@/components/ui/Field';
import { ErrorState, LinesSkeleton, PageSkeleton } from '@/components/ui/states';
import { ConnectionChip } from '@/layout/ConnectionChip';
import { useConnectionNotice } from '@/layout/useConnectionNotice';
import { focusFirstError } from '@/lib/focusFirstError';
import { ApiError } from '@/services/api/errors';
import { renderWithProviders } from './render';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('how long a request has waited', () => {
  it('is grey with time to spare, amber from half the target, red past it', () => {
    renderWithProviders(
      <>
        <AgeBadge hours={5} targetHours={24} />
        <AgeBadge hours={13} targetHours={24} />
        <AgeBadge hours={30} targetHours={24} />
      </>,
    );
    expect(screen.getByText('5 h')).toHaveClass('bg-surface-variant');
    expect(screen.getByText('13 h')).toHaveClass('bg-warning-muted');
    expect(screen.getByText('30 h')).toHaveClass('bg-error-muted');
    // The target is one hover away, so "why amber" has an answer.
    expect(screen.getByText('13 h')).toHaveAttribute('title', 'Target: within 24 h');
  });
});

describe('the connection', () => {
  function setOnline(online: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
    act(() => {
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
    });
  }

  function Shell() {
    useConnectionNotice();
    return <ConnectionChip />;
  }

  it('says so in the top bar while it is gone, and once when it is back', async () => {
    renderWithProviders(<Shell />);
    expect(screen.queryByText('No connection')).not.toBeInTheDocument();

    setOnline(false);
    expect(screen.getByText('No connection')).toBeInTheDocument();

    setOnline(true);
    expect(screen.queryByText('No connection')).not.toBeInTheDocument();
    expect(await screen.findByText('Back online')).toBeInTheDocument();
  });
});

describe('a screen that failed', () => {
  it('draws no answer at all apart from an answer that said no', () => {
    const { container, unmount } = renderWithProviders(
      <ErrorState error={new ApiError({ code: 'network', message: 'down' })} />,
    );
    expect(container.querySelector('.tfd-empty-draw')).toHaveClass('text-warning');
    unmount();

    const refused = renderWithProviders(
      <ErrorState error={new ApiError({ code: 'forbidden', status: 403, message: 'no' })} />,
    );
    expect(refused.container.querySelector('.tfd-empty-draw')).toHaveClass('text-error');
  });

  it('tries again from its button', async () => {
    const retry = vi.fn();
    renderWithProviders(<ErrorState error={new Error('x')} onRetry={retry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('rows that come and go', () => {
  type Row = { id: string; name: string };
  const columns: ColumnDef<Row, unknown>[] = [{ accessorKey: 'name', header: 'Name' }];
  const page = (rows: Row[], total = rows.length): Paged<Row> => ({
    items: rows,
    page: 0,
    pageSize: 25,
    total,
    nextPage: null,
  });
  const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: `Row ${id}` }));

  function Grid({ data, leaving }: { data: Paged<Row>; leaving?: ReadonlySet<string> }) {
    return (
      <DataTable
        columns={columns}
        page={data}
        loading={false}
        error={null}
        getRowId={(row) => row.id}
        onPageChange={() => {}}
        emptyState={null}
        label="Rows"
        leavingIds={leaving}
      />
    );
  }

  const stateOf = (name: string) => screen.getByText(name).closest('tr')?.getAttribute('data-row-state');

  it('lights a row that arrived while the list was open, and not the ones already there', async () => {
    const { rerender } = renderWithProviders(<Grid data={page(rows)} />);
    expect(stateOf('Row a')).toBeNull();

    rerender(<Grid data={page([{ id: 'e', name: 'Row e' }, ...rows], 5)} />);
    await waitFor(() => expect(stateOf('Row e')).toBe('new'));
    expect(stateOf('Row a')).toBeNull();
  });

  it('does not light a whole new list (a filter, a page) as arrivals', async () => {
    const { rerender } = renderWithProviders(<Grid data={page(rows)} />);
    const other = ['w', 'x', 'y', 'z'].map((id) => ({ id, name: `Row ${id}` }));
    rerender(<Grid data={page(other, 9)} />);
    await screen.findByText('Row w');
    expect(stateOf('Row w')).toBeNull();
  });

  it('slides out the rows just decided', () => {
    renderWithProviders(<Grid data={page(rows)} leaving={new Set(['b'])} />);
    expect(stateOf('Row b')).toBe('leaving');
    expect(stateOf('Row a')).toBeNull();
  });
});

describe('a form that was refused', () => {
  it('goes to the first field to fix', async () => {
    renderWithProviders(
      <form>
        <Field label="Name">{({ id }) => <Input id={id} defaultValue="Saman" />}</Field>
        <Field label="NIC" error="Enter the NIC">
          {({ id, invalid }) => <Input id={id} invalid={invalid} />}
        </Field>
        <Field label="Phone" error="Enter a phone">
          {({ id }) => <Input id={id} />}
        </Field>
      </form>,
    );
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    focusFirstError();
    await waitFor(() => expect(screen.getByLabelText(/^NIC/)).toHaveFocus());
    expect(scroll).toHaveBeenCalled();
  });
});

describe('copying', () => {
  it('turns into a tick when the copy lands', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderWithProviders(<CopyButton text="5708" label="Copy the supplier number" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy the supplier number' }));
    expect(writeText).toHaveBeenCalledWith('5708');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});

describe('loading', () => {
  it('draws the shape of what is coming, and still says "Loading" to a screen reader', () => {
    renderWithProviders(
      <>
        <PageSkeleton />
        <LinesSkeleton lines={2} />
      </>,
    );
    expect(screen.getAllByRole('status', { name: 'Loading…' })).toHaveLength(2);
  });
});
