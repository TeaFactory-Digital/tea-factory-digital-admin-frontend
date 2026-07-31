/**
 * Page controls for a data grid: first, previous, where you are, next, last.
 *
 * **One number, the current page.** Not a row of page buttons: the ends of the
 * list are already one click away on the chevrons, and a numbered row grows and
 * re-flows as the count changes, so the button under the cursor is not the button
 * that was there a moment ago. A clerk stepping through 84 suppliers clicks the
 * same pixel every time.
 *
 * Two things it deliberately does not do:
 *
 *  - **No total-pages arithmetic in the caller.** The grid is server-paged, so the
 *    envelope's `total` and `pageSize` are the only source of truth for how many
 *    pages exist; computing it in three screens is three chances to be off by one.
 *  - **No page-size selector.** Each grid picks a size that suits its rows (50
 *    suppliers, 25 requests), and a clerk who sets 200 on an office connection
 *    gets a slow list and blames the console.
 *
 * Pages are **zero-based on the wire and one-based on screen**, matching the API
 * envelope (§17.5). The conversion happens here and nowhere else.
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export interface PaginationProps {
  /** Zero-based, as the API sends it. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Disables every control while a page is in flight. */
  busy?: boolean;
  /** Rendered at the start of the bar — the "Showing 1–50 of 84" line. */
  children?: ReactNode;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  busy,
  children,
}: PaginationProps) {
  const { t } = useTranslation();

  // `total` can be 0, and an empty grid still renders a bar rather than jumping
  // the layout when the last row is filtered out.
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  const atStart = page <= 0;
  const atEnd = page >= last;

  const step = (target: number, disabled: boolean, label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || busy}
      onClick={() => onPageChange(target)}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-text-primary',
        'hover:bg-surface-variant disabled:cursor-not-allowed disabled:text-disabled-contrast disabled:hover:bg-surface',
      )}
    >
      {icon}
    </button>
  );

  return (
    /**
     * Count at the start of the bar, controls at the end.
     *
     * `justify-between` with the count in a `min-w-0` box rather than letting the
     * two sit next to each other: the count changes width on the last page
     * ("Showing 51–84 of 84"), and the controls must not shuffle sideways when it
     * does — a clerk paging through a list clicks the same pixel every time.
     */
    <div className="flex shrink-0 items-center justify-between gap-md border-t border-divider px-md py-sm">
      <div className="min-w-0">{children}</div>

      <nav aria-label={t('common.pagination')} className="flex shrink-0 items-center gap-xs">
        {step(0, atStart, t('common.firstPage'), <ChevronsLeft className="size-icon-sm" aria-hidden />)}
        {step(page - 1, atStart, t('common.previousPage'), <ChevronLeft className="size-icon-sm" aria-hidden />)}

        {/**
         * Where you are — a label, not a control. It was a `<button>` while there
         * were several numbers to choose between; on its own it would be a button
         * whose only action is to reload the page you are already on.
         */}
        <span
          aria-current="page"
          className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-label text-primary-contrast numeric"
        >
          <span aria-hidden>{page + 1}</span>
          {/* A filled circle says nothing to a screen reader, and a bare "1" says
              almost as little — so the announced text carries the count. */}
          <span className="sr-only">{t('common.pageOf', { page: page + 1, total: last + 1 })}</span>
        </span>

        {step(page + 1, atEnd, t('common.nextPage'), <ChevronRight className="size-icon-sm" aria-hidden />)}
        {step(last, atEnd, t('common.lastPage'), <ChevronsRight className="size-icon-sm" aria-hidden />)}
      </nav>
    </div>
  );
}
