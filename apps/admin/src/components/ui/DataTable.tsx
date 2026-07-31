/**
 * The data grid. The console is mostly grids, so this is the component that
 * decides whether the office is fast or slow.
 *
 * Four decisions, each of them from admin-console.md §18.2 ("speed of the
 * repetitive path beats richness of the rare one"):
 *
 *  1. **Server-side paging and sorting.** A factory has thousands of suppliers;
 *     loading them all to sort in the browser is a 30-second first paint on an
 *     office connection shared with the phones.
 *  2. **Keyboard row navigation.** ↑/↓ move, Enter opens. A clerk working a queue
 *     never has to reach for the mouse.
 *  3. **A sticky header.** Twelve columns of a hundred-row page is unreadable
 *     once the header scrolls away.
 *  4. **Rows are `<tr>`, not divs.** A real table means "next column" works in a
 *     screen reader and the office can paste it into a spreadsheet, which is
 *     where the office lives (§19.5).
 */

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Paged } from '@tfd/domain';
import { cn } from '@/lib/cn';
import { Pagination } from './Pagination';
import { ErrorState, TableSkeleton } from './states';

export interface DataTableProps<Row> {
  columns: ColumnDef<Row, unknown>[];
  page: Paged<Row> | undefined;
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
  getRowId: (row: Row) => string;
  onRowActivate?: (row: Row) => void;
  onPageChange: (page: number) => void;
  /** Server-side sort. Omit to render a non-sortable grid. */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  emptyState: ReactNode;
  /** Accessible name for the grid — required, and it is not the page title. */
  label: string;
}

export function DataTable<Row>({
  columns,
  page,
  loading,
  error,
  onRetry,
  getRowId,
  onRowActivate,
  onPageChange,
  sorting,
  onSortingChange,
  emptyState,
  label,
}: DataTableProps<Row>) {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const table = useReactTable({
    data: page?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    /**
     * Two clicks, not three.
     *
     * TanStack's default cycle is ascending → descending → *unsorted*, and that
     * third state is a lie here: the query still has to send some order, so the
     * rows come back sorted while no column shows a direction. A clerk sees a
     * sorted grid whose headers deny it.
     */
    enableSortingRemoval: false,
    state: sorting ? { sorting } : undefined,
    onSortingChange: onSortingChange
      ? (updater) => {
          const next = typeof updater === 'function' ? updater(sorting ?? []) : updater;
          onSortingChange(next);
        }
      : undefined,
  });

  /**
   * The three non-grid states take the space the grid would have taken.
   *
   * `flex-1 min-h-0` rather than natural height: the card is a fixed-height
   * column, so a short error inside a tall card would otherwise leave the
   * pagination bar floating in the middle of it.
   */
  if (error)
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  if (loading && !page)
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <TableSkeleton columns={columns.length} />
      </div>
    );
  if (page && page.items.length === 0)
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">{emptyState}</div>
    );

  /** ↑/↓ between rows, Enter to open. Focus stays inside the grid. */
  function handleKeyDown(event: KeyboardEvent<HTMLTableSectionElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = Array.from(bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[tabindex]') ?? []);
    const index = rows.indexOf(document.activeElement as HTMLTableRowElement);
    const nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1;
    const next = rows[nextIndex];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  const from = page ? page.page * page.pageSize + 1 : 0;
  const to = page ? Math.min(page.total, from + page.items.length - 1) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/**
       * The only scrolling region on a grid screen, in both axes.
       *
       * Horizontal because twelve columns will not fit a 1366 px laptop, and
       * vertical because the header, the filters above it and the pagination
       * below it have to stay put: a clerk reading row sixty still needs to know
       * which column is which, and still needs "Next" without scrolling back.
       * The page body itself never scrolls — see `AppShell`.
       */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-data-cell" aria-label={label}>
          {/**
           * Sticky against the scroll container above, not the page.
           *
           * The bottom rule is a `shadow` rather than a `border`, because
           * `border-collapse: collapse` hands table borders to the table itself —
           * so a border on a sticky `th` is painted at the row's original
           * position and slides away under the header. A shadow is painted by the
           * cell, so it travels with it.
           */}
          <thead className="sticky top-0 z-10 bg-table-header shadow-[inset_0_-1px_0_0_var(--color-border)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort() && Boolean(onSortingChange);
                  const direction = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        direction === 'asc'
                          ? 'ascending'
                          : direction === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className="px-md py-sm text-left text-data-header whitespace-nowrap text-text-secondary uppercase"
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          // `uppercase` is repeated from the `th` on purpose: the
                          // UA stylesheet sets `text-transform: none` on form
                          // controls, so a button does NOT inherit it. Without
                          // this, sortable headers render mixed-case next to
                          // uppercase non-sortable ones.
                          className="inline-flex items-center gap-xxs rounded-sm uppercase hover:text-text-primary"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {direction === 'asc' ? (
                            <ChevronUp className="size-icon-xs" aria-hidden />
                          ) : direction === 'desc' ? (
                            <ChevronDown className="size-icon-xs" aria-hidden />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody ref={bodyRef} onKeyDown={handleKeyDown}>
            {table.getRowModel().rows.map((row, index) => (
              <tr
                key={getRowId(row.original)}
                // Rows are focusable and activatable only when there is somewhere
                // to go. A `tabindex` on a non-interactive row is a keyboard trap
                // that leads nowhere.
                tabIndex={onRowActivate ? 0 : undefined}
                onClick={onRowActivate ? () => onRowActivate(row.original) : undefined}
                onKeyDown={
                  onRowActivate
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowActivate(row.original);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-b border-divider',
                  index % 2 === 1 && 'bg-table-row-alt',
                  onRowActivate && 'cursor-pointer hover:bg-table-row-hover focus:bg-table-row-hover',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-md py-sm align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page ? (
        <Pagination
          page={page.page}
          pageSize={page.pageSize}
          total={page.total}
          onPageChange={onPageChange}
          busy={loading}
        >
          <p className="numeric text-caption text-text-secondary">
            {t('common.showing', { from, to, total: page.total })}
          </p>
        </Pagination>
      ) : null}
    </div>
  );
}
