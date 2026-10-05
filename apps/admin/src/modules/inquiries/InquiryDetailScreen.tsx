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

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  BellRing,
  BellOff,
  Building2,
  CalendarClock,
  CircleSlash,
  Hourglass,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import { QUEUE_SLA_HOURS, type InquiryMessage } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { AuditPanel } from '@/components/AuditPanel';
import { InfoTip } from '@/components/ui/Tooltip';
import { SPLIT_PANE_BOTH, SPLIT_PANE_SCROLLER } from '@/components/ui/layout';
import { cn } from '@/lib/cn';
import { formatAge, formatDate, formatDateTime } from '@/lib/format';
import { isAnswerable } from './answerable';
import { InquiryActions } from './ReplyDialog';
import { InquiryAssignmentCard, InquiryNotesCard } from './InquiryOfficeCards';
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
  const rows = toRows(thread);
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

      {/* The page does not scroll on a wide window: the chat scrolls inside its card, the
          reply box stays under it, and the side column scrolls on its own. Below `lg` the
          columns stack and the page scrolls as usual (see `SPLIT_PANE_BOTH`). */}
      <div className={cn(SPLIT_PANE_BOTH, 'lg:grid-cols-3')}>
        <Card className="flex flex-col lg:col-span-2 lg:min-h-0">
          <CardHeader title={t('inquiries.detail.conversation')} />
          <CardBody className="flex flex-col gap-lg lg:min-h-0 lg:flex-1">
            <dl className="grid shrink-0 gap-md sm:grid-cols-3">
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

            {/* The conversation as a chat: the supplier on the left, the office (this
                console's side) on the right, a separator for each day. Scrolls on its own
                and opens at the latest message, with the reply box right under it. */}
            <ChatThread
              rows={rows}
              supplierName={inquiry.supplierName}
              pushNote={
                /* Said plainly either way: a clerk who assumes a notification went out
                   does not follow up, and one who assumes it did not telephones a
                   supplier who has already been told. */
                <span
                  className={cn(
                    'inline-flex items-center gap-xs rounded-full py-xxs pr-xxs pl-sm text-caption font-medium',
                    pushesOnReply
                      ? 'bg-success-muted text-success'
                      : 'bg-surface text-text-secondary',
                  )}
                >
                  {pushesOnReply ? (
                    <BellRing className="size-icon-xs" aria-hidden />
                  ) : (
                    <BellOff className="size-icon-xs" aria-hidden />
                  )}
                  {pushesOnReply
                    ? t('inquiries.detail.pushSentShort')
                    : t('inquiries.detail.pushNotSentShort')}
                  {/* The why, for whoever wants it, instead of two lines under every answer. */}
                  <InfoTip compact label={t('inquiries.detail.pushWhy')}>
                    {pushesOnReply
                      ? t('inquiries.detail.pushSent')
                      : t('inquiries.detail.pushNotSent')}
                  </InfoTip>
                </span>
              }
              footer={
                inquiry.status === 'closed' ? (
                  <li className="flex flex-col items-center gap-sm py-sm text-center">
                    <span className="flex items-center gap-xs rounded-full bg-surface-variant px-md py-xxs text-caption text-text-secondary">
                      <CircleSlash className="size-icon-xs" aria-hidden />
                      {inquiry.closedByName && inquiry.closedAt
                        ? t('inquiries.detail.closedBy', {
                            name: inquiry.closedByName,
                            when: formatDateTime(inquiry.closedAt),
                          })
                        : t('inquiries.detail.closed')}
                    </span>
                    {inquiry.closureNote ? (
                      <p className="max-w-prose rounded-md border border-dashed border-border px-md py-sm text-body-small text-text-secondary">
                        {inquiry.closureNote}
                      </p>
                    ) : null}
                  </li>
                ) : open ? (
                  <li className="flex items-center gap-sm self-start pl-11 text-caption text-text-secondary">
                    <span className="size-2 animate-pulse rounded-full bg-warning" aria-hidden />
                    {t('inquiries.detail.awaitingReply')}
                  </li>
                ) : null
              }
            />

            {answerable ? (
              <div className="shrink-0 border-t border-divider pt-lg">
                <InquiryActions inquiry={inquiry} />
              </div>
            ) : null}
          </CardBody>
        </Card>

        <div className={cn('flex flex-col gap-lg', SPLIT_PANE_SCROLLER)}>
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

          <InquiryAssignmentCard inquiry={inquiry} />
          <InquiryNotesCard inquiry={inquiry} />

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

type Row =
  | { type: 'day'; key: string; label: string }
  | {
      type: 'message';
      message: InquiryMessage;
      first: boolean;
      last: boolean;
      latestOffice: boolean;
    };

/** Messages from one side within this long of each other read as one burst. */
const GROUP_MS = 5 * 60_000;

function together(a?: InquiryMessage, b?: InquiryMessage): boolean {
  if (!a || !b || a.author !== b.author) return false;
  const ta = new Date(a.createdAt);
  const tb = new Date(b.createdAt);
  return (
    ta.toDateString() === tb.toDateString() && Math.abs(tb.getTime() - ta.getTime()) < GROUP_MS
  );
}

/** A day separator before each new day; each message marked as first or last of its burst. */
function toRows(messages: InquiryMessage[]): Row[] {
  const lastOffice = messages.map((m) => m.author).lastIndexOf('office');
  const rows: Row[] = [];
  let lastDay = '';
  messages.forEach((message, index) => {
    const at = new Date(message.createdAt);
    const day = Number.isNaN(at.getTime()) ? '' : at.toDateString();
    if (day && day !== lastDay) {
      rows.push({ type: 'day', key: `day-${day}`, label: formatDate(message.createdAt) });
      lastDay = day;
    }
    rows.push({
      type: 'message',
      message,
      first: !together(messages[index - 1], message),
      last: !together(message, messages[index + 1]),
      latestOffice: index === lastOffice,
    });
  });
  return rows;
}

function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ChatThread({
  rows,
  supplierName,
  pushNote,
  footer,
}: {
  rows: Row[];
  supplierName: string;
  pushNote: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  const end = useRef<HTMLLIElement>(null);
  // Open at the latest message, and follow a new one in.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [rows.length]);

  return (
    // Below `lg` a fixed height keeps a long thread from pushing the reply box far down
    // the page; above it the card's height is the window's, and the thread takes the rest.
    // `max-lg:` rather than a `lg:max-h-none` override: this theme's `none` sizes to 0.
    <ol className="flex flex-col gap-xs overflow-y-auto rounded-lg bg-surface-variant/50 p-md max-lg:max-h-[60vh] lg:min-h-0 lg:flex-1">
      {rows.map((row) =>
        row.type === 'day' ? (
          <li key={row.key} className="my-sm self-center">
            <span className="rounded-full bg-surface px-md py-xxs text-caption text-text-secondary shadow-sm">
              {row.label}
            </span>
          </li>
        ) : (
          <Bubble
            key={row.message.id}
            row={row}
            name={
              row.message.authorName ||
              (row.message.author === 'office' ? t('inquiries.detail.office') : supplierName)
            }
            avatar={
              row.message.author === 'office' ? (
                <Building2 className="size-icon-sm" aria-hidden />
              ) : (
                initials(supplierName)
              )
            }
            note={row.latestOffice ? pushNote : undefined}
          />
        ),
      )}
      {footer}
      <li ref={end} aria-hidden className="h-px" />
    </ol>
  );
}

/**
 * One message. The supplier on the left; the office, this console's own side, on the
 * right in the brand colour. Name above the first of a burst, avatar beside its last,
 * time inside the bubble.
 */
function Bubble({
  row,
  name,
  avatar,
  note,
}: {
  row: Extract<Row, { type: 'message' }>;
  name: string;
  avatar: ReactNode;
  note?: ReactNode;
}) {
  const { message, first, last } = row;
  const office = message.author === 'office';
  return (
    <li className={cn('flex items-end gap-sm', office && 'flex-row-reverse', first && 'mt-sm')}>
      <span className="w-9 shrink-0">
        {last ? (
          <span
            aria-hidden
            className={cn(
              'flex size-9 items-center justify-center rounded-full text-caption font-semibold',
              office ? 'bg-primary text-primary-contrast' : 'bg-primary-muted text-primary',
            )}
          >
            {avatar}
          </span>
        ) : null}
      </span>
      <div className={cn('flex max-w-[75%] flex-col gap-xxs', office && 'items-end')}>
        {first ? (
          <span className="px-xs text-caption font-semibold text-text-secondary">{name}</span>
        ) : null}
        <div
          className={cn(
            'rounded-xl px-md pt-sm pb-xs shadow-sm',
            office
              ? 'bg-primary text-primary-contrast'
              : 'border border-border bg-surface text-text-primary',
            office ? (last ? 'rounded-br-sm' : '') : last ? 'rounded-bl-sm' : '',
          )}
        >
          <p className="text-body whitespace-pre-line">{message.body}</p>
          <p
            className={cn(
              'mt-xxs text-right text-caption',
              office ? 'text-primary-contrast/80' : 'text-text-secondary',
            )}
            title={message.createdAt ? formatDateTime(message.createdAt) : undefined}
          >
            {clock(message.createdAt)}
          </p>
        </div>
        {note ? <span className="mt-xxs">{note}</span> : null}
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
