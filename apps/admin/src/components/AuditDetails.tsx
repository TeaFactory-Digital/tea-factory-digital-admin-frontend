/**
 * What an audit entry changed, as labelled lines rather than JSON.
 *
 * Kept to the point (24 November 2026): a long text that changed shows only the part that
 * changed, a few words either side, removed struck through and added marked, with the full
 * before and after one click away; more than three fields fold behind "+N more". A whole
 * help page printed twice in a row made one entry fill the screen.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auditDetailLines, type AuditDetailLine } from '@/lib/auditDetails';
import { changeExcerpt } from '@/lib/textChange';

const SHOWN = 3;
/** Past this, a value is a text to excerpt rather than a value to print. */
const LONG = 100;

export function AuditDetails({ before, after }: { before?: unknown; after?: unknown }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const lines = auditDetailLines(before, after, t);

  if (lines.length === 0) return null;
  const shown = all ? lines : lines.slice(0, SHOWN);

  return (
    <dl className="flex flex-col gap-xxs rounded-sm bg-surface-variant px-sm py-xs text-caption">
      {shown.map((line) => (
        <div key={line.key} className="flex flex-wrap gap-x-xs">
          <dt className="text-text-secondary">{line.label}:</dt>
          <dd className="min-w-0 flex-1 break-words text-text-primary">
            <LineValue line={line} />
          </dd>
        </div>
      ))}
      {lines.length > SHOWN ? (
        <button
          type="button"
          className="self-start font-medium text-primary hover:underline"
          onClick={() => setAll(!all)}
        >
          {all ? t('audit.change.fewer') : t('audit.change.more', { count: lines.length - SHOWN })}
        </button>
      ) : null}
    </dl>
  );
}

function LineValue({ line }: { line: AuditDetailLine }) {
  const { t } = useTranslation();
  const [full, setFull] = useState(false);
  const { before, after } = line;

  if (before === undefined || after === undefined) return <>{after ?? before}</>;
  if (before.length <= LONG && after.length <= LONG) {
    return (
      <>
        <span className="text-text-secondary line-through">{before}</span>
        {' → '}
        {after}
      </>
    );
  }

  const excerpt = changeExcerpt(before, after);
  return (
    <span className="flex flex-col gap-xxs">
      <span>
        {excerpt.leading ? (
          <span className="text-text-secondary">
            {excerpt.cutStart ? '…' : ''}
            {excerpt.leading}
          </span>
        ) : null}
        {excerpt.removed ? (
          <del className="rounded-sm bg-error-muted px-xxs text-error">
            <span className="sr-only">{t('audit.change.removed')} </span>
            {excerpt.removed}
          </del>
        ) : null}
        {excerpt.added ? (
          <ins className="rounded-sm bg-success-muted px-xxs text-success no-underline">
            <span className="sr-only">{t('audit.change.added')} </span>
            {excerpt.added}
          </ins>
        ) : null}
        {excerpt.trailing ? (
          <span className="text-text-secondary">
            {excerpt.trailing}
            {excerpt.cutEnd ? '…' : ''}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        className="self-start font-medium text-primary hover:underline"
        aria-expanded={full}
        onClick={() => setFull(!full)}
      >
        {full ? t('audit.change.hideFull') : t('audit.change.showFull')}
      </button>
      {full ? (
        <span className="grid gap-xs md:grid-cols-2">
          <FullText label={t('audit.change.before')} text={before} />
          <FullText label={t('audit.change.after')} text={after} />
        </span>
      ) : null}
    </span>
  );
}

function FullText({ label, text }: { label: string; text: string }) {
  return (
    <span className="flex flex-col gap-xxs">
      <span className="font-medium text-text-secondary">{label}</span>
      <span className="relative max-h-48 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-surface p-xs text-text-primary">
        {text}
      </span>
    </span>
  );
}
