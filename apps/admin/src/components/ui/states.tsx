/**
 * Loading, empty and error states.
 *
 * These are primitives rather than per-screen markup because they are where a
 * console usually lies. A grid that shows an empty table while it loads reads as
 * "no suppliers"; a failed request that renders nothing reads as "the queue is
 * clear". Both are worse than an error, because the clerk acts on them.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { errorMessageKey } from '@/lib/errorMessage';
import { Button } from './Button';
import { SpinnerMark } from './SpinnerMark';

/**
 * The standalone spinner: a screen is fetching, and nothing else on it is worth
 * announcing yet.
 *
 * `role="status"` with a label rather than a bare graphic, because this is often
 * the only thing on the screen — a clerk on a screen reader hears "Loading…"
 * instead of silence. The arc itself is `aria-hidden` inside `SpinnerMark`, so the
 * name comes from here and is announced once.
 *
 * The arc is `text-primary`, so it follows the tenant's brand rather than the
 * artwork's fixed blue.
 *
 * Size is a variant, not a class the caller appends. `cn` joins without resolving
 * conflicts, on purpose (see `lib/cn`), so a caller passing `size-icon-sm` next to
 * the default `size-icon-lg` gets whichever Tailwind happens to emit last — which
 * is `lg`, silently. The prop is the version that works.
 */
const SPINNER_SIZES = {
  sm: 'size-icon-sm',
  md: 'size-icon-md',
  lg: 'size-icon-lg',
} as const;

export function Spinner({
  size = 'lg',
  className,
}: {
  size?: keyof typeof SPINNER_SIZES;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span role="status" aria-label={t('common.loading')} className={cn('inline-flex', className)}>
      <SpinnerMark className={cn(SPINNER_SIZES[size], 'text-primary')} />
    </span>
  );
}

/** A shimmering block, sized by the caller to match what will replace it. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-sm bg-surface-variant', className)}
    />
  );
}

/** Rows of skeleton, for a table that is loading its first page. */
export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-xs p-md">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-md">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-sm px-lg py-xxxl text-center">
      {icon ? <div className="text-text-secondary">{icon}</div> : null}
      <p className="text-subtitle text-text-primary">{title}</p>
      {body ? <p className="max-w-prose text-body-small text-text-secondary">{body}</p> : null}
      {action}
    </div>
  );
}

/**
 * An error, with the specific reason where one is known.
 *
 * `errorMessageKey` maps the domain code — which only works because the transport
 * preserves it instead of flattening it to the HTTP status (§17.7).
 */
export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-sm text-center',
        compact ? 'px-md py-lg' : 'px-lg py-xxxl',
      )}
    >
      <TriangleAlert className="size-icon-xl text-error" aria-hidden />
      <p className="text-subtitle text-text-primary">{t('error.title')}</p>
      <p className="max-w-prose text-body-small text-text-secondary">{t(errorMessageKey(error))}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A banner for something the office should notice but that does not block work —
 * degraded config, mock data, a tenant note.
 */
export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
}) {
  const tones = {
    info: 'bg-info-muted text-info',
    warning: 'bg-warning-muted text-warning',
    error: 'bg-error-muted text-error',
  } as const;

  return (
    <div
      role="status"
      className={cn('flex items-start gap-sm px-lg py-sm text-body-small', tones[tone])}
    >
      {children}
    </div>
  );
}
