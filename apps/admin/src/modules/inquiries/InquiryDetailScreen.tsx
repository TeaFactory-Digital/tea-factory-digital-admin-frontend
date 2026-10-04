/**
 * M10 — one message, and the answer to it.
 *
 * Laid out as a conversation rather than as a record with fields, because that is
 * what it is: the supplier said something, the office says something back, and the
 * second is rendered in the app underneath the first. Showing the reply in the same
 * shape the supplier will see it is the cheapest way to stop a clerk writing an
 * answer that only makes sense next to a screen the supplier does not have.
 *
 * **Whether a notification is sent is read, not asserted.** §17.5's `inquiryReplied`
 * category now has M13 behind it, and whether it fires is a per-factory trigger — so this
 * screen asks rather than claiming either way. It used to say flatly that nothing was
 * sent, which was true until M13 landed and would have quietly become a lie. A reply
 * lands in the app the next time it is opened. The note under the reply says so —
 * a clerk who believes a text message went out is a clerk who does not follow up.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  BellOff,
  Building2,
  CalendarClock,
  CircleSlash,
  Hourglass,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import { QUEUE_SLA_HOURS } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { AuditPanel } from '@/components/AuditPanel';
import { cn } from '@/lib/cn';
import { formatAge, formatDateTime } from '@/lib/format';
import { isAnswerable } from './answerable';
import { InquiryActions } from './ReplyDialog';
import { useNotificationTriggers } from '@/modules/notifications/hooks';
import { useInquiry, useInquiryAudit } from './hooks';

const STATUS_TONES = { open: 'warning', resolved: 'success', closed: 'neutral' } as const;

export function InquiryDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: inquiry, isPending, error, refetch } = useInquiry(id);
  const { data: audit, isPending: auditPending } = useInquiryAudit(id);

  /**
   * Does answering push anything to the supplier's phone?
   *
   * Read from M13's trigger rather than stated, and **tolerant of a refusal**: a clerk
   * holds `inquiries: A` and may hold no `content` grant at all, in which case this 403s.
   * An unanswerable question is treated as "no push", which is the safer of the two
   * wrong answers: it makes the clerk follow up rather than assume the supplier was told.
   */
  const triggers = useNotificationTriggers();
  const pushesOnReply = Boolean(
    triggers.data?.find((trigger) => trigger.category === 'inquiryReplied')?.enabled,
  );

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending || !inquiry) {
    return (
      <div className="flex flex-col gap-lg">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-lg lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const open = inquiry.status === 'open';
  const answerable = isAnswerable(inquiry);
  // Built by the repository from the question and the answer when the API sends no thread.
  const thread = inquiry.messages ?? [];
  const lastOfficeIndex = thread.map((message) => message.author).lastIndexOf('office');
  const late = open && inquiry.ageHours > QUEUE_SLA_HOURS.inquiries;
  const fromApp = inquiry.channel === 'app';

  return (
    <>
      <PageHeader
        title={inquiry.subject}
        description={t('inquiries.detail.from', {
          name: inquiry.supplierName,
          code: inquiry.supplierCode,
        })}
        breadcrumb={
          <Link to="/inquiries" className="hover:text-text-primary">
            {t('inquiries.title')}
          </Link>
        }
        actions={
          <Badge tone={STATUS_TONES[inquiry.status]}>
            {t(`inquiries.status.${inquiry.status}`)}
          </Badge>
        }
      />

      <div className="grid items-start gap-lg lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('inquiries.detail.conversation')} />
          <CardBody className="flex flex-col gap-lg">
            <dl className="grid gap-md sm:grid-cols-3">
              <Fact
                icon={CalendarClock}
                label={t('inquiries.detail.receivedLabel')}
                value={formatDateTime(inquiry.createdAt)}
              />
              <Fact
                icon={fromApp ? Smartphone : Building2}
                label={t('inquiries.detail.channelLabel')}
                value={
                  inquiry.createdByName
                    ? `${t(`changeRequests.channel.${inquiry.channel}`)} · ${inquiry.createdByName}`
                    : t(`changeRequests.channel.${inquiry.channel}`)
                }
              />
              {open ? (
                <Fact
                  icon={Hourglass}
                  label={t('inquiries.detail.waitingLabel')}
                  value={formatAge(inquiry.ageHours)}
                  tone={late ? 'error' : undefined}
                />
              ) : null}
            </dl>

            {/* The thread, shaped the way the supplier sees it in the app: their message,
                then the office's answer underneath. */}
            <ol className="flex flex-col gap-md border-t border-divider pt-lg">
              {thread.map((message, index) => {
                const office = message.author === 'office';
                // The push note belongs under the office's latest answer only.
                const latestAnswer = office && index === lastOfficeIndex;
                return (
                  <Message
                    key={message.id}
                    side={message.author}
                    avatar={
                      office ? (
                        <Building2 className="size-icon-sm" aria-hidden />
                      ) : (
                        initials(inquiry.supplierName)
                      )
                    }
                    name={
                      message.authorName ||
                      (office ? t('inquiries.detail.office') : inquiry.supplierName)
                    }
                    when={message.createdAt ? formatDateTime(message.createdAt) : ''}
                    body={message.body}
                    footer={
                      latestAnswer ? (
                        /* Said plainly either way: a clerk who assumes a notification
                           went out does not follow up, and one who assumes it did not
                           telephones a supplier who has already been told. */
                        <span className="flex items-center gap-xs">
                          {pushesOnReply ? (
                            <Bell className="size-icon-xs" aria-hidden />
                          ) : (
                            <BellOff className="size-icon-xs" aria-hidden />
                          )}
                          {pushesOnReply
                            ? t('inquiries.detail.pushSent')
                            : t('inquiries.detail.pushNotSent')}
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}

              {inquiry.status === 'closed' ? (
                <li className="flex flex-col items-center gap-sm py-sm text-center">
                  <span className="flex items-center gap-xs text-caption text-text-secondary">
                    <CircleSlash className="size-icon-xs" aria-hidden />
                    {inquiry.closedByName && inquiry.closedAt
                      ? t('inquiries.detail.closedBy', {
                          name: inquiry.closedByName,
                          when: formatDateTime(inquiry.closedAt),
                        })
                      : t('inquiries.detail.closed')}
                  </span>
                  {inquiry.closureNote ? (
                    <p className="max-w-prose rounded-md bg-surface-variant px-md py-sm text-body-small text-text-primary">
                      {inquiry.closureNote}
                    </p>
                  ) : null}
                </li>
              ) : null}

              {open ? (
                <li className="flex items-center gap-sm self-end text-caption text-text-secondary">
                  <span className="size-2 animate-pulse rounded-full bg-warning" aria-hidden />
                  {t('inquiries.detail.awaitingReply')}
                </li>
              ) : null}
            </ol>

            {answerable ? (
              <div className="border-t border-divider pt-lg">
                <InquiryActions inquiry={inquiry} />
              </div>
            ) : null}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-lg">
          <Card>
            <CardHeader title={t('changeRequests.column.supplier')} />
            <CardBody className="flex flex-col gap-md">
              <div className="flex items-center gap-md">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-muted text-subtitle font-semibold text-primary"
                >
                  {initials(inquiry.supplierName)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-subtitle text-text-primary">
                    {inquiry.supplierName}
                  </span>
                  <span className="numeric text-caption text-text-secondary">
                    {inquiry.supplierCode}
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-xs">
                <Link
                  to={`/suppliers/${inquiry.supplierId}`}
                  className="inline-flex items-center gap-xs self-start text-body-small font-medium text-primary hover:underline"
                >
                  {t('changeRequests.detail.supplierLink')}
                  <ArrowUpRight className="size-icon-sm" aria-hidden />
                </Link>
                {/* Their earlier messages: the same question asked three times is a
                    different problem from three different questions. */}
                <Link
                  to={`/inquiries?supplierId=${inquiry.supplierId}&status=resolved`}
                  className="inline-flex items-center gap-xs self-start text-body-small font-medium text-primary hover:underline"
                >
                  <MessageSquare className="size-icon-sm" aria-hidden />
                  {t('inquiries.detail.history')}
                </Link>
              </div>
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

/** One message in the thread: the supplier's on the left, the office's on the right. */
function Message({
  side,
  avatar,
  name,
  when,
  body,
  footer,
}: {
  side: 'supplier' | 'office';
  avatar: ReactNode;
  name: string;
  when: string;
  body: string;
  footer?: ReactNode;
}) {
  const office = side === 'office';
  return (
    <li className={cn('flex items-end gap-sm', office && 'flex-row-reverse')}>
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-caption font-semibold',
          office ? 'bg-primary text-primary-contrast' : 'bg-primary-muted text-primary',
        )}
      >
        {avatar}
      </span>
      <div className={cn('flex max-w-[85%] flex-col gap-xxs', office && 'items-end')}>
        <span className="text-caption text-text-secondary">
          <span className="font-semibold text-text-primary">{name}</span>
          {when ? ` · ${when}` : ''}
        </span>
        <p
          className={cn(
            'rounded-lg px-md py-sm text-body whitespace-pre-line text-text-primary',
            office ? 'rounded-br-sm bg-primary-muted' : 'rounded-bl-sm bg-surface-variant',
          )}
        >
          {body}
        </p>
        {footer ? <span className="text-caption text-text-secondary">{footer}</span> : null}
      </div>
    </li>
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
