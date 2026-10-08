/**
 * One headline figure: what it is, the number, how it moved, and its recent shape.
 *
 * The stat-tile contract (dataviz): a sentence-case label, the value in the same sans as
 * everything else, an optional signed delta against a *named* period, and an optional
 * twelve-point trend. A tile whose figure has no history simply has no sparkline. It does
 * not get a decorative one.
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function StatCard({
  icon: Icon,
  label,
  period,
  value,
  delta,
  caption,
  trend,
  footer,
  className,
}: {
  icon: LucideIcon;
  label: ReactNode;
  /** The window the figure covers, e.g. "This month". */
  period?: ReactNode;
  value: ReactNode;
  /** A `DeltaPill`, or any short status beside the caption. */
  delta?: ReactNode;
  caption?: ReactNode;
  /** A `Sparkline`, drawn to the right of the figure. */
  trend?: ReactNode;
  /** Full-width content under the figure, e.g. a `Meter`. */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex animate-rise flex-col gap-md rounded-lg border border-border bg-surface p-lg shadow-card',
        className,
      )}
    >
      <header className="flex items-center gap-sm text-label text-text-secondary">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-icon-sm" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate font-medium">{label}</h2>
        {period ? <span className="shrink-0 text-caption">{period}</span> : null}
      </header>

      <div className="flex items-end justify-between gap-md">
        <div className="flex min-w-0 flex-col gap-sm">
          <p className="numeric text-h2 font-semibold tracking-tight text-text-primary">{value}</p>
          {delta || caption ? (
            <div className="flex flex-wrap items-center gap-xs text-caption text-text-secondary">
              {delta}
              {caption ? <span className="min-w-0">{caption}</span> : null}
            </div>
          ) : null}
        </div>
        {trend}
      </div>

      {footer}
    </section>
  );
}
