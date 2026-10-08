import type { ReactNode } from 'react';

/**
 * The heading every module screen starts with.
 *
 * One `<h1>` per page, here — so the document outline is right and a screen
 * reader's "jump to heading" lands somewhere useful rather than on a card title.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="flex animate-rise flex-wrap items-end justify-between gap-md">
      <div className="min-w-0">
        {breadcrumb ? (
          <div className="mb-xs text-label text-text-secondary">{breadcrumb}</div>
        ) : null}
        <h1 className="text-h2 font-semibold tracking-tight text-text-primary">{title}</h1>
        {description ? (
          <p className="mt-xs text-body-small text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-sm">{actions}</div> : null}
    </header>
  );
}
