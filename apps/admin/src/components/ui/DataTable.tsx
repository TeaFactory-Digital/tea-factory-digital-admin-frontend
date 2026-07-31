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
import { Button } from './Button';
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
    state: sorting ? { sorting } : undefined,
    onSortingChange: onSortingChange
      ? (updater) => {
          const next = typeof updater === 'function' ? updater(sorting ?? []) : updater;
          onSortingChange(next);
        }
      : undefined,
  });

  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !page) return <TableSkeleton columns={columns.length} />;
  if (page && page.items.length === 0) return <>{emptyState}</>;

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
    <div className="flex flex-col">
      {/* The one place horizontal scrolling is allowed — inside the grid, never
          on the page body. Twelve columns will not fit a 1366 px laptop. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-data-cell" aria-label={label}>
          <thead className="sticky top-0 z-10 bg-table-header">
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
                      className="border-b border-border px-md py-sm text-left text-data-header whitespace-nowrap text-text-secondary uppercase"
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
        <div className="flex flex-wrap items-center justify-between gap-md border-t border-divider px-md py-sm">
          <p className="numeric text-caption text-text-secondary">
            {t('common.showing', { from, to, total: page.total })}
          </p>
          <div className="flex items-center gap-sm">
            <Button
              size="sm"
              variant="secondary"
              disabled={page.page === 0 || loading}
              onClick={() => onPageChange(page.page - 1)}
            >
              {t('common.previous')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page.nextPage === null || loading}
              onClick={() => onPageChange(page.page + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
