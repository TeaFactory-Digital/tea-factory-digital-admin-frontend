/**
 * M10 — one message, and the answer to it.
 *
 * Laid out as a conversation rather than as a record with fields, because that is
 * what it is: the supplier said something, the office says something back, and the
 * second is rendered in the app underneath the first. Showing the reply in the same
 * shape the supplier will see it is the cheapest way to stop a clerk writing an
 * answer that only makes sense next to a screen the supplier does not have.
 *
 * **No notification is sent from here**, and the console does not pretend
 * otherwise. §17.5's `inquiryReplied` category exists and M13 does not, so a reply
 * lands in the app the next time it is opened. The note under the reply says so —
 * a clerk who believes a text message went out is a clerk who does not follow up.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { AuditPanel } from '@/components/AuditPanel';
import { formatAge, formatDateTime } from '@/lib/format';
import { InquiryActions } from './ReplyDialog';
import { useInquiry, useInquiryAudit } from './hooks';

const STATUS_TONES = { open: 'warning', resolved: 'success', closed: 'neutral' } as const;

export function InquiryDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: inquiry, isPending, error, refetch } = useInquiry(id);
  const { data: audit, isPending: auditPending } = useInquiryAudit(id);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending || !inquiry) {
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
        title={inquiry.subject}
        description={`${inquiry.supplierCode} · ${inquiry.supplierName}`}
        breadcrumb={
          <Link to="/inquiries" className="hover:text-text-primary">
            {t('inquiries.title')}
          </Link>
        }
        actions={
          <>
            <Badge tone={STATUS_TONES[inquiry.status]}>
              {t(`inquiries.status.${inquiry.status}`)}
            </Badge>
            {inquiry.status === 'open' ? (
              <Badge tone="neutral">
                {t('changeRequests.detail.waiting', { age: formatAge(inquiry.ageHours) })}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          <Card>
            <CardHeader
              title={t('inquiries.detail.message')}
              description={t('changeRequests.detail.submitted', {
                when: formatDateTime(inquiry.createdAt),
              })}
            />
            <CardBody className="flex flex-col gap-md">
              <p className="text-body whitespace-pre-line text-text-primary">{inquiry.message}</p>

              <p className="text-caption text-text-secondary">
                {t('changeRequests.column.channel')}:{' '}
                {t(`changeRequests.channel.${inquiry.channel}`)}
                {inquiry.createdByName ? ` · ${inquiry.createdByName}` : ''}
              </p>

              <InquiryActions inquiry={inquiry} />
            </CardBody>
          </Card>

          {inquiry.reply ? (
            <Card>
              <CardHeader
                title={t('inquiries.detail.reply')}
                description={t('inquiries.detail.repliedBy', {
                  name: inquiry.reply.repliedByName,
                  when: formatDateTime(inquiry.reply.repliedAt),
                })}
              />
              <CardBody className="flex flex-col gap-md">
                <blockquote className="border-l-2 border-primary pl-md text-body whitespace-pre-line text-text-primary">
                  {inquiry.reply.body}
                </blockquote>
                {/* Said plainly, because the alternative is a clerk assuming a
                    notification went out. M13 is not built (status.md §21.24). */}
                <Notice tone="info">
                  <span>{t('inquiries.detail.noPushYet')}</span>
                </Notice>
              </CardBody>
            </Card>
          ) : null}

          {inquiry.closureNote ? (
            <Card>
              <CardHeader
                title={t('inquiries.detail.closed')}
                description={t('inquiries.detail.closedBy', {
                  name: inquiry.closedByName ?? '',
                  when: formatDateTime(inquiry.closedAt),
                })}
              />
              <CardBody>
                <blockquote className="border-l-2 border-divider pl-md text-body text-text-primary">
                  {inquiry.closureNote}
                </blockquote>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-lg">
          <Card>
            <CardHeader title={t('changeRequests.column.supplier')} />
            <CardBody className="flex flex-col gap-xs">
              <p className="numeric text-subtitle text-text-primary">{inquiry.supplierCode}</p>
              <p className="text-body-small text-text-secondary">{inquiry.supplierName}</p>
              <Link
                to={`/suppliers/${inquiry.supplierId}`}
                className="mt-sm text-body-small text-primary underline"
              >
                {t('changeRequests.detail.supplierLink')}
              </Link>
              {/* Their earlier messages: the same question asked three times is a
                  different problem from three different questions. */}
              <Link
                to={`/inquiries?supplierId=${inquiry.supplierId}&status=resolved`}
                className="flex items-center gap-xs text-body-small text-primary underline"
              >
                <MessageSquare className="size-icon-sm" aria-hidden />
                {t('inquiries.detail.history')}
              </Link>
            </CardBody>
          </Card>

          <AuditPanel
            title={t('inquiries.detail.auditTitle')}
            page={audit}
            loading={auditPending}
          />
        </div>
      </div>
    </>
  );
}
