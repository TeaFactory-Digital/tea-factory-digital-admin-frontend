/**
 * Status pill.
 *
 * Colour is never the only signal: every badge carries its own text. A queue
 * coloured red with no label is unreadable to the ~8% of male suppliers' worth of
 * office staff with red-green colour blindness, and unreadable in a printed
 * screenshot pasted into an email, which is how the office actually escalates.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'primary';

/**
 * The tones that lead with a dot.
 *
 * Status tones only. A neutral chip is a label rather than a state, and the primary tone
 * is the count badge, where a dot beside a number would read as a second figure. The dot
 * is drawn in `currentColor`, so it is the pill's own text colour and needs no token.
 */
const DOT_TONES = new Set<BadgeTone>(['success', 'warning', 'error', 'info']);

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-variant text-text-secondary',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  error: 'bg-error-muted text-error',
  info: 'bg-info-muted text-info',
  primary: 'bg-primary-muted text-primary',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot = true,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Off where the pill is not a state, e.g. a count. */
  dot?: boolean;
}) {
  const showDot = dot && DOT_TONES.has(tone);
  return (
    <span
      className={cn(
        /**
         * `w-fit` because a pill must hug its text wherever it is put.
         *
         * `inline-flex` sizes to content on its own, but a badge is very often the first
         * child of a `flex flex-col` cell (a status over the date it happened, in six
         * grids at the last count) and a column flex container stretches its children to
         * the full width by default. That turned every "Signed in" into a pale green bar
         * the width of the column, which reads as a filled progress track rather than as
         * a status.
         *
         * A definite width wins over `align-self: stretch`, so this fixes the width
         * without touching vertical alignment, which `self-start` would have changed for
         * every badge sitting in a row.
         */
        'inline-flex w-fit items-center gap-xs rounded-pill px-sm py-xxs text-caption font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {showDot ? (
        <svg aria-hidden viewBox="0 0 6 6" className="size-1.5 shrink-0 fill-current">
          <circle cx="3" cy="3" r="3" />
        </svg>
      ) : null}
      {children}
    </span>
  );
}

/** A count that means "waiting for you". Zero renders nothing, not a `0`. */
export function CountBadge({ count, tone = 'primary' }: { count: number; tone?: BadgeTone }) {
  if (count <= 0) return null;
  return (
    <Badge tone={tone} dot={false} className="numeric min-w-6 justify-center">
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
