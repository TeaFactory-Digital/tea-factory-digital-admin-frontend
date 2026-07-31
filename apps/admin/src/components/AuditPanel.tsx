/**
 * The audit trail for one record.
 *
 * Shown on a supplier and on a change request, and it is the console's proof of
 * AC-09: every approve, reject, rate change, publish and payout appears with
 * actor and before/after. An approval the office cannot demonstrate was recorded
 * is an approval that will be disputed six months later, when nobody remembers.
 *
 * Renders nothing at all when the user has no `auditLog` access — the §12.1
 * matrix gives it to accountant and above, and an empty panel labelled "audit
 * trail" would read as "nothing was recorded".
 */

import { useTranslation } from 'react-i18next';
import type { AuditEntry, Paged } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/states';
import { formatDateTime } from '@/lib/format';
import { auditActionLabel } from '@/lib/auditLabels';

export function AuditPanel({
  title,
  page,
  loading,
}: {
  title: string;
  page: Paged<AuditEntry> | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const allowed = useCan('auditLog');

  if (!allowed) return null;

  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {loading ? (
          <div className="flex flex-col gap-xs">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !page || page.items.length === 0 ? (
          <p className="text-body-small text-text-secondary">{t('audit.empty')}</p>
        ) : (
          <ol className="flex flex-col gap-sm">
            {page.items.map((entry) => (
              <li key={entry.id} className="border-l-2 border-divider pl-md">
                <p className="text-body-small text-text-primary">
                  {auditActionLabel(entry.action, t)}
                </p>
                <p className="numeric text-caption text-text-secondary">
                  {entry.actorName} · {formatDateTime(entry.at)}
                  {entry.ip ? ` · ${entry.ip}` : ''}
                </p>
                {/* Before/after as JSON is not pretty, and it is deliberate: an
                    audit entry is evidence, and a prettified summary is an
                    interpretation of evidence. */}
                {entry.after ? (
                  <pre className="mt-xxs overflow-x-auto rounded-sm bg-surface-variant px-sm py-xs text-caption text-text-secondary">
                    {JSON.stringify(entry.after)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
