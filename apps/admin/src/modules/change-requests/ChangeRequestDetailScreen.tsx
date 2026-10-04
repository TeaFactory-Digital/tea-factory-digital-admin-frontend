/**
 * M9 — one change request.
 *
 * §18.1 describes this screen as "current vs requested side by side, evidence
 * attachment, approve/reject with note". The side-by-side is the whole design:
 * the office is deciding whether to *replace* a value, and a form that showed
 * only the new one would be asking them to approve a change they cannot see.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileX2,
  Hourglass,
  Paperclip,
  Smartphone,
  XCircle,
} from 'lucide-react';
import type { ChangeRequestType, RequestStatus } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { AuditPanel } from '@/components/AuditPanel';
import { cn } from '@/lib/cn';
import { formatAge, formatDateTime } from '@/lib/format';
import { ChangeComparison } from './ChangeComparison';
import { DecisionActions } from './DecisionDialog';
import { useChangeRequest, useChangeRequestAudit } from './hooks';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;
/** Past this, the waiting time is shown as a problem rather than a fact. */
const LATE_HOURS = 72;

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
        <div className="grid gap-lg lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const pending = request.status === 'pending';
  const late = pending && request.ageHours > LATE_HOURS;
  const fromApp = request.channel === 'app';

  return (
    <>
      <PageHeader
        title={t('changeRequests.detail.heading', {
          type: t(`changeRequests.type.${request.type as ChangeRequestType}`),
        })}
        description={`${request.supplierCode} · ${request.supplierName}`}
        breadcrumb={
          <Link to="/change-requests" className="hover:text-text-primary">
            {t('changeRequests.title')}
          </Link>
        }
        actions={
          <Badge tone={STATUS_TONES[request.status as RequestStatus]}>
            {t(`changeRequests.status.${request.status}`)}
          </Badge>
        }
      />

      <div className="grid items-start gap-lg lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          <Card>
            <CardHeader
              title={t('changeRequests.detail.whatChanges')}
              description={t('changeRequests.detail.whatChangesHint')}
            />
            <CardBody className="flex flex-col gap-lg">
              <ChangeComparison request={request} />

              {/* The three facts that decide how careful to be: when, through what, how long. */}
              <dl className="grid gap-md sm:grid-cols-3">
                <Fact
                  icon={CalendarClock}
                  label={t('changeRequests.detail.submittedLabel')}
                  value={formatDateTime(request.createdAt)}
                />
                <Fact
                  icon={fromApp ? Smartphone : Building2}
                  label={t('changeRequests.detail.channelLabel')}
                  value={
                    fromApp
                      ? t('changeRequests.channel.app')
                      : request.createdByName
                        ? t('changeRequests.detail.enteredBy', { name: request.createdByName })
                        : t('changeRequests.channel.office')
                  }
                />
                {pending ? (
                  <Fact
                    icon={Hourglass}
                    label={t('changeRequests.detail.waitingLabel')}
                    value={formatAge(request.ageHours)}
                    tone={late ? 'error' : undefined}
                  />
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {request.decision ? (
            <Card>
              <CardHeader title={t('changeRequests.detail.decision')} />
              <CardBody className="flex flex-col gap-md">
                <p className="flex items-center gap-sm text-body-small text-text-primary">
                  {request.status === 'approved' ? (
                    <CheckCircle2 className="size-icon-md text-success" aria-hidden />
                  ) : (
                    <XCircle className="size-icon-md text-error" aria-hidden />
                  )}
                  {t('changeRequests.detail.decidedBy', {
                    status: t(`changeRequests.status.${request.status}`),
                    name: request.decision.decidedByName || t('changeRequests.detail.someone'),
                    // Not sent by the current API; a dash rather than a made-up time.
                    when: request.decision.decidedAt
                      ? formatDateTime(request.decision.decidedAt)
                      : '—',
                  })}
                </p>
                {/* The note the supplier reads, shown verbatim. */}
                <figure className="rounded-md bg-surface-variant p-md">
                  <figcaption className="text-caption text-text-secondary">
                    {t('changeRequests.detail.supplierReads')}
                  </figcaption>
                  <blockquote className="mt-xs border-l-2 border-primary pl-md text-body text-text-primary">
                    {request.decision.note}
                  </blockquote>
                </figure>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t('changeRequests.detail.evidence')} />
            <CardBody>
              {request.attachments.length === 0 ? (
                <div className="flex items-start gap-md rounded-md border border-dashed border-border p-md">
                  <FileX2 className="size-icon-md shrink-0 text-text-secondary" aria-hidden />
                  <div>
                    <p className="text-body-small font-medium text-text-primary">
                      {t('changeRequests.detail.noEvidence')}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {t('changeRequests.detail.noEvidenceHint')}
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="grid gap-sm sm:grid-cols-2">
                  {request.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-sm rounded-md border border-border p-md text-body-small text-primary hover:bg-surface-variant"
                      >
                        <Paperclip className="size-icon-sm shrink-0" aria-hidden />
                        <span className="truncate">{attachment.filename}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-lg">
          {pending ? (
            <Card>
              <CardHeader
                title={t('changeRequests.detail.decideTitle')}
                description={t('changeRequests.detail.decideHint')}
              />
              <CardBody>
                <DecisionActions request={request} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t('changeRequests.column.supplier')} />
            <CardBody className="flex flex-col gap-md">
              <div className="flex items-center gap-md">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-muted text-subtitle font-semibold text-primary"
                >
                  {initials(request.supplierName)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-subtitle text-text-primary">
                    {request.supplierName}
                  </span>
                  <span className="numeric text-caption text-text-secondary">
                    {request.supplierCode}
                  </span>
                </span>
              </div>
              <Link
                to={`/suppliers/${request.supplierId}`}
                className="inline-flex items-center gap-xs self-start text-body-small font-medium text-primary hover:underline"
              >
                {t('changeRequests.detail.supplierLink')}
                <ArrowUpRight className="size-icon-sm" aria-hidden />
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

function Fact({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: ReactNode;
  tone?: 'error';
}) {
  return (
    <div className="flex items-start gap-sm">
      <Icon
        className={cn(
          'mt-xxs size-icon-sm shrink-0',
          tone === 'error' ? 'text-error' : 'text-text-secondary',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <dt className="text-caption text-text-secondary">{label}</dt>
        <dd
          className={cn(
            'text-body-small',
            tone === 'error' ? 'font-semibold text-error' : 'text-text-primary',
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
