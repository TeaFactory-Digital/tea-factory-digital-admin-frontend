/**
 * Loading, empty and error states.
 *
 * These are primitives rather than per-screen markup because they are where a
 * console usually lies. A grid that shows an empty table while it loads reads as
 * "no suppliers"; a failed request that renders nothing reads as "the queue is
 * clear". Both are worse than an error, because the clerk acts on them.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Inbox, Lock, PackageOpen, RotateCw, SearchX, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';
import { motionAllowed } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { errorMessageKey } from '@/lib/errorMessage';
import { Button } from './Button';
import { SpinnerMark } from './SpinnerMark';

/**
 * The standalone spinner: a screen is fetching, and nothing else on it is worth
 * announcing yet.
 *
 * `role="status"` with a label rather than a bare graphic, because this is often
 * the only thing on the screen: a clerk on a screen reader hears "Loading…"
 * instead of silence. The arc itself is `aria-hidden` inside `SpinnerMark`, so the
 * name comes from here and is announced once.
 *
 * The arc is `text-primary`, so it follows the tenant's brand rather than the
 * artwork's fixed blue.
 *
 * Size is a variant, not a class the caller appends. `cn` joins without resolving
 * conflicts, on purpose (see `lib/cn`), so a caller passing `size-icon-sm` next to
 * the default `size-icon-lg` gets whichever Tailwind happens to emit last, which
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
      className={cn('block animate-pulse rounded-md bg-surface-variant', className)}
    />
  );
}

const LINE_WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-5/6', 'w-3/4'];

/**
 * Lines of text still to come, inside a card or a dialog (26 November 2026): the shape of
 * what is loading instead of a spinner in an empty box, so nothing jumps when it arrives.
 * Still a "Loading" status for a screen reader, as the spinner was.
 */
export function LinesSkeleton({ lines = 3 }: { lines?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-sm py-xs">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-4', LINE_WIDTHS[index % LINE_WIDTHS.length])} />
      ))}
    </div>
  );
}

/** A whole screen still to come: its title, the line under it, and a card of rows. */
export function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-lg">
      <div className="flex flex-col gap-xs">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-lg shadow-card">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className={cn('h-4', LINE_WIDTHS[index % LINE_WIDTHS.length])} />
        ))}
      </div>
    </div>
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

/**
 * What an empty list means (26 November 2026), so the picture says it before the words do:
 *
 *  - `clear`: a queue with nothing waiting. The work is done; an inbox with a tick.
 *  - `search`: a search or filter that matched nothing. Change it; a magnifier with a cross.
 *  - `empty`: nothing has been made yet (news, a report, a timeline); an open, empty box.
 *  - `locked`: a screen this person or this factory cannot use; a padlock.
 */
export type EmptyKind = 'clear' | 'search' | 'empty' | 'locked';

const EMPTY_ICON: Record<EmptyKind, LucideIcon> = {
  clear: Inbox,
  search: SearchX,
  empty: PackageOpen,
  locked: Lock,
};

/**
 * The picture above an empty or failed state (26 November 2026): a soft disc, an icon that
 * draws itself in, and an optional badge that pops on last. It moves once, as it appears,
 * and is then still (`tfd-empty` in `theme.css`). Decoration only: the words beside it are
 * what a screen reader hears.
 */
export function StatePicture({
  Icon,
  icon,
  tone = 'primary',
  badge,
  small = false,
}: {
  Icon: LucideIcon;
  icon?: ReactNode;
  tone?: 'primary' | 'error' | 'warning';
  badge?: ReactNode;
  small?: boolean;
}) {
  const drawn = useRef<HTMLSpanElement>(null);
  // Every stroke measured as length 1, before the first paint, so a short line and a long
  // one draw in over the same time instead of the short ones being done at once.
  useLayoutEffect(() => {
    drawn.current
      ?.querySelectorAll('path, line, polyline, polygon, rect, circle')
      .forEach((shape) => shape.setAttribute('pathLength', '1'));
  }, [Icon, icon]);
  const tones = {
    primary: ['bg-primary/5', 'bg-primary-muted', 'text-primary'],
    error: ['bg-error/5', 'bg-error-muted', 'text-error'],
    warning: ['bg-warning/5', 'bg-warning-muted', 'text-warning'],
  } as const;
  const [halo, disc, ink] = tones[tone];
  return (
    <div aria-hidden className={cn('relative mb-xs flex items-center justify-center', small ? 'size-14' : 'size-20')}>
      <span className={cn('tfd-empty-disc absolute inset-0 rounded-full', halo)} />
      <span className={cn('tfd-empty-disc tfd-empty-disc-inner absolute rounded-full', small ? 'inset-1.5' : 'inset-2', disc)} />
      <span ref={drawn} className={cn('tfd-empty-draw relative flex', ink)}>
        {icon ?? <Icon className={small ? 'size-6' : 'size-8'} strokeWidth={1.75} />}
      </span>
      {badge ? <span className="tfd-empty-pop absolute right-1 bottom-1">{badge}</span> : null}
    </div>
  );
}

/**
 * An empty list, said with a picture and a sentence.
 *
 * The picture moves **once**, as it appears (`tfd-empty` in `theme.css`): a soft disc
 * settles, the icon draws itself in, and for `clear` a tick pops onto it. Then it is still:
 * an empty screen that kept moving would look like one still loading. The Animations switch
 * and reduced motion show it finished at once. Decoration only; the title is what a screen
 * reader hears.
 */
export function EmptyState({
  title,
  body,
  action,
  icon,
  kind = 'empty',
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  /** A screen's own icon in place of the kind's; it draws in the same way. */
  icon?: ReactNode;
  kind?: EmptyKind;
}) {
  return (
    <div className="tfd-empty flex flex-col items-center gap-sm px-lg py-xxxl text-center">
      <StatePicture
        Icon={EMPTY_ICON[kind]}
        icon={icon}
        badge={
          kind === 'clear' ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-success text-on-status shadow-card ring-2 ring-surface">
              <Check className="size-icon-xs" strokeWidth={3} />
            </span>
          ) : undefined
        }
      />
      <p className="tfd-empty-text text-subtitle text-text-primary">{title}</p>
      {body ? <p className="tfd-empty-text max-w-prose text-body-small text-text-secondary">{body}</p> : null}
      {action}
    </div>
  );
}

/**
 * An error, with the specific reason where one is known.
 *
 * `errorMessageKey` maps the domain code, which only works because the transport
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
  const key = errorMessageKey(error);
  // No answer at all (a dropped connection, a timeout) is a different trouble from an
  // answer that said no, and the picture says which before the words do (26 November 2026).
  const connection = key === 'error.network' || key === 'error.timeout';
  const spin = useRef<SVGSVGElement>(null);

  function retry() {
    // The retry first: the turn of the arrow is decoration and must never stand in its way.
    onRetry?.();
    // One turn, so the press is seen even when the answer comes back the same. Not every
    // browser an office runs has `animate`; there the arrow simply stays still.
    const arrow = spin.current;
    if (motionAllowed() && arrow && typeof arrow.animate === 'function') {
      arrow.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: 600,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        'tfd-empty flex flex-col items-center gap-sm text-center',
        compact ? 'px-md py-lg' : 'px-lg py-xxxl',
      )}
    >
      <StatePicture Icon={connection ? WifiOff : TriangleAlert} tone={connection ? 'warning' : 'error'} small={compact} />
      <p className="tfd-empty-text text-subtitle text-text-primary">{t('error.title')}</p>
      <p className="tfd-empty-text max-w-prose text-body-small text-text-secondary">{t(key)}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={retry}
          iconLeft={<RotateCw ref={spin} className="size-icon-sm" aria-hidden />}
        >
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A banner for something the office should notice but that does not block work:
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
      className={cn('flex items-start gap-sm rounded-md px-lg py-sm text-body-small', tones[tone])}
    >
      {children}
    </div>
  );
}
