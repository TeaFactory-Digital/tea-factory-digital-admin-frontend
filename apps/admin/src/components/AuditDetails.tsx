/** What an audit entry changed, as labelled lines rather than JSON. */

import { useTranslation } from 'react-i18next';
import { auditDetailLines } from '@/lib/auditDetails';

export function AuditDetails({ before, after }: { before?: unknown; after?: unknown }) {
  const { t } = useTranslation();
  const lines = auditDetailLines(before, after, t);

  if (lines.length === 0) return null;

  return (
    <dl className="mt-xxs flex flex-col gap-xxs rounded-sm bg-surface-variant px-sm py-xs text-caption">
      {lines.map((line) => (
        <div key={line.key} className="flex flex-wrap gap-x-xs">
          <dt className="text-text-secondary">{line.label}:</dt>
          <dd className="break-words text-text-primary">
            {line.before !== undefined && line.after !== undefined ? (
              <>
                <span className="text-text-secondary line-through">{line.before}</span>
                {' → '}
                {line.after}
              </>
            ) : (
              (line.after ?? line.before)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
