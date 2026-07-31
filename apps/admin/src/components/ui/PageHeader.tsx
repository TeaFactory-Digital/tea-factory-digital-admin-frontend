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
    <header className="flex flex-wrap items-end justify-between gap-md">
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-xxs text-caption text-text-secondary">{breadcrumb}</div> : null}
        <h1 className="text-h3 text-text-primary">{title}</h1>
        {description ? (
          <p className="mt-xxs text-body-small text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-sm">{actions}</div> : null}
    </header>
  );
}
