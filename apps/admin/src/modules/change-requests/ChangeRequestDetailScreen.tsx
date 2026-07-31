/**
 * M9 — one change request.
 *
 * §18.1 describes this screen as "current vs requested side by side, evidence
 * attachment, approve/reject with note". The side-by-side is the whole design:
 * the office is deciding whether to *replace* a value, and a form that showed
 * only the new one would be asking them to approve a change they cannot see.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Paperclip } from 'lucide-react';
import type { ChangeRequestType, RequestStatus } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { AuditPanel } from '@/components/AuditPanel';
import { formatAge, formatDateTime } from '@/lib/format';
import { DecisionActions } from './DecisionDialog';
import { useChangeRequest, useChangeRequestAudit } from './hooks';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;

export function ChangeRequestDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: request, isPending, error, refetch } = useChangeRequest(id);
  const { data: audit, isPending: auditPending } = useChangeRequestAudit(id);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending || !request) {
    return (
      <div className="flex flex-col gap-lg">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t(`changeRequests.type.${request.type as ChangeRequestType}`)}
        description={`${request.supplierCode} · ${request.supplierName}`}
        breadcrumb={
          <Link to="/change-requests" className="hover:text-text-primary">
            {t('changeRequests.title')}
          </Link>
        }
        actions={
          <>
            <Badge tone={STATUS_TONES[request.status as RequestStatus]}>
              {t(`changeRequests.status.${request.status}`)}
            </Badge>
            {request.status === 'pending' ? (
              <Badge tone={request.ageHours > 72 ? 'error' : 'neutral'}>
                {t('changeRequests.detail.waiting', { age: formatAge(request.ageHours) })}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          <Card>
            <CardHeader
              title={t('changeRequests.detail.comparison')}
              description={t('changeRequests.detail.submitted', {
                when: formatDateTime(request.createdAt),
              })}
            />
            <CardBody>
              <div className="grid items-center gap-md sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-md border border-border bg-surface-variant p-lg">
                  <p className="text-overline text-text-secondary uppercase">
                    {t('changeRequests.detail.currentHeading')}
                  </p>
                  <p className="mt-xs text-subtitle text-text-primary">{request.currentSummary}</p>
                </div>

                <ArrowRight
                  className="mx-auto size-icon-lg rotate-90 text-text-secondary sm:rotate-0"
                  aria-hidden
                />

                <div className="rounded-md border border-primary bg-primary-muted p-lg">
                  <p className="text-overline text-primary uppercase">
                    {t('changeRequests.detail.requestedHeading')}
                  </p>
                  <p className="mt-xs text-subtitle font-semibold text-text-primary">
                    {request.requestedSummary}
                  </p>
                </div>
              </div>

              <p className="mt-md text-caption text-text-secondary">
                {t('changeRequests.column.channel')}:{' '}
                {t(`changeRequests.channel.${request.channel}`)}
                {request.createdByName ? ` · ${request.createdByName}` : ''}
              </p>

              <div className="mt-lg">
                <DecisionActions request={request} />
              </div>
            </CardBody>
          </Card>

          {request.decision ? (
            <Card>
              <CardHeader title={t('changeRequests.detail.decision')} />
              <CardBody className="flex flex-col gap-sm">
                <p className="text-caption text-text-secondary">
                  {t('changeRequests.detail.decidedBy', {
                    status: t(`changeRequests.status.${request.status}`),
                    name: request.decision.decidedByName,
                    when: formatDateTime(request.decision.decidedAt),
                  })}
                </p>
                {/* The note the supplier reads, shown verbatim. */}
                <blockquote className="border-l-2 border-primary pl-md text-body text-text-primary">
                  {request.decision.note}
                </blockquote>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t('changeRequests.detail.evidence')} />
            <CardBody>
              {request.attachments.length === 0 ? (
                <p className="text-body-small text-text-secondary">
                  {t('changeRequests.detail.noEvidence')}
                </p>
              ) : (
                <ul className="flex flex-col gap-xs">
                  {request.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-sm text-body-small text-primary underline"
                      >
                        <Paperclip className="size-icon-sm" aria-hidden />
                        {attachment.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-lg">
          <Card>
            <CardHeader title={t('changeRequests.column.supplier')} />
            <CardBody className="flex flex-col gap-xs">
              <p className="numeric text-subtitle text-text-primary">{request.supplierCode}</p>
              <p className="text-body-small text-text-secondary">{request.supplierName}</p>
              <Link
                to={`/suppliers/${request.supplierId}`}
                className="mt-sm text-body-small text-primary underline"
              >
                {t('changeRequests.detail.supplierLink')}
              </Link>
            </CardBody>
          </Card>

          <AuditPanel
            title={t('changeRequests.detail.auditTitle')}
            page={audit}
            loading={auditPending}
          />
        </div>
      </div>
    </>
  );
}
