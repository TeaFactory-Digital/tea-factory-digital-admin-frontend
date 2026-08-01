/**
 * M7 — one credit request.
 *
 * The screen is arranged around the only question it exists to answer: **may this
 * supplier have this money, and how do we know?** So the eligibility working takes
 * the main column rather than sitting in a sidebar — it is the evidence, not
 * context — and the decision controls sit directly beneath it, where the reader
 * already is when they have finished reading.
 *
 * A decided request shows the figures it was **decided against**, not today's. The
 * server stops recomputing eligibility once a request leaves `pending` for exactly
 * this reason: a decision reviewed six months later has to be judged on what was
 * true when it was made, and a panel that quietly re-derived would make every past
 * approval look wrong the moment a supplier's leaf changed.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { RequestStatus } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { AuditPanel } from '@/components/AuditPanel';
import { formatAge, formatAmount, formatDateTime } from '@/lib/format';
import { CreditDecisionActions } from './CreditDecisionDialog';
import { EligibilityPanel } from './EligibilityPanel';
import { useCreditRequest, useCreditRequestAudit } from './hooks';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;

export function CreditRequestDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: request, isPending, error, refetch } = useCreditRequest(id);
  const { data: audit, isPending: auditPending } = useCreditRequestAudit(id);

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
        title={t('credit.detail.title', {
          facility: t(`credit.facility.${request.facility}`),
          amount: formatAmount(request.amount),
        })}
        description={`${request.supplierCode} · ${request.supplierName}`}
        breadcrumb={
          <Link to="/credit" className="hover:text-text-primary">
            {t('credit.title')}
          </Link>
        }
        actions={
          <>
            <Badge tone={STATUS_TONES[request.status as RequestStatus]}>
              {t(`credit.status.${request.status}`)}
            </Badge>
            {request.status === 'pending' ? (
              <Badge tone="neutral">
                {t('changeRequests.detail.waiting', { age: formatAge(request.ageHours) })}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          <EligibilityPanel eligibility={request.eligibility} amount={request.amount} />

          <Card>
            <CardHeader
              title={t('credit.detail.request')}
              description={t('changeRequests.detail.submitted', {
                when: formatDateTime(request.createdAt),
              })}
            />
            <CardBody className="flex flex-col gap-md">
              <dl className="divide-y divide-divider">
                <DetailRow
                  label={t('credit.column.facility')}
                  value={t(`credit.facility.${request.facility}`)}
                />
                <DetailRow
                  label={t('credit.requested')}
                  numeric
                  value={formatAmount(request.amount)}
                />
                {request.manureType ? (
                  <DetailRow label={t('credit.detail.manureType')} value={request.manureType} />
                ) : null}
                {request.quantityKg !== null ? (
                  <DetailRow
                    label={t('credit.detail.quantity')}
                    numeric
                    value={`${request.quantityKg} kg`}
                  />
                ) : null}
                <DetailRow
                  label={t('changeRequests.column.channel')}
                  value={
                    request.createdByName
                      ? `${t(`changeRequests.channel.${request.channel}`)} · ${request.createdByName}`
                      : t(`changeRequests.channel.${request.channel}`)
                  }
                />
              </dl>

              {/* The supplier's own words, verbatim. It is often the only thing
                  that distinguishes two identical-looking requests. */}
              {request.reason ? (
                <div>
                  <p className="text-overline text-text-secondary uppercase">
                    {t('credit.detail.reason')}
                  </p>
                  <blockquote className="mt-xxs border-l-2 border-divider pl-md text-body text-text-primary">
                    {request.reason}
                  </blockquote>
                </div>
              ) : null}

              <CreditDecisionActions request={request} />
            </CardBody>
          </Card>

          {request.decision ? (
            <Card>
              <CardHeader title={t('credit.detail.decision')} />
              <CardBody className="flex flex-col gap-sm">
                <p className="text-caption text-text-secondary">
                  {t('changeRequests.detail.decidedBy', {
                    status: t(`credit.status.${request.status}`),
                    name: request.decision.decidedByName,
                    when: formatDateTime(request.decision.decidedAt),
                  })}
                </p>
                <blockquote className="border-l-2 border-primary pl-md text-body text-text-primary">
                  {request.decision.note}
                </blockquote>
                {/* What it was decided against, stated rather than implied. */}
                <p className="numeric text-caption text-text-secondary">
                  {t('credit.detail.decidedAgainst', {
                    ceiling: formatAmount(request.eligibility.ceiling),
                    when: formatDateTime(request.eligibility.computedAt),
                  })}
                </p>
              </CardBody>
            </Card>
          ) : null}
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
              {/* Their other open facilities: one supplier with two requests against
                  one set of leaf is the case a per-request screen hides. */}
              <Link
                to={`/credit?supplierId=${request.supplierId}&status=pending`}
                className="text-body-small text-primary underline"
              >
                {t('credit.detail.otherRequests')}
              </Link>
            </CardBody>
          </Card>

          <AuditPanel
            title={t('credit.detail.auditTitle')}
            page={audit}
            loading={auditPending}
          />
        </div>
      </div>
    </>
  );
}
