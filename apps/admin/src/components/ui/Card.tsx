/**
 * A panel. The console's only container primitive.
 *
 * Deliberately unopinionated about padding on the body, because a card wrapping a
 * data grid must not pad it — a table needs to reach its own edges so the sticky
 * header lines up with the rows.
 */

import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface', className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-md border-b border-divider px-lg py-md',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-title text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-xxs text-body-small text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-sm">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('px-lg py-md', className)}>{children}</div>;
}

export function CardFooter({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-end gap-sm border-t border-divider px-lg py-md',
        className,
      )}
    >
      {children}
    </footer>
  );
}

/**
 * A label/value pair, the console's most repeated shape.
 *
 * `value` takes a node rather than a string so a `null` money field can render as
 * an em dash in muted text — never as `LKR 0.00`, which is a number the office
 * would have to explain (BR-102).
 */
export function DetailRow({
  label,
  value,
  numeric,
}: {
  label: ReactNode;
  value: ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-sm py-xs">
      <dt className="text-body-small text-text-secondary">{label}</dt>
      <dd className={cn('text-body-small text-text-primary', numeric && 'numeric')}>{value}</dd>
    </div>
  );
}
