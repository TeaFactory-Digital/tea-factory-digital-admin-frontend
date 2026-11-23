/**
 * "Your work today" (24 November 2026), at the top of the dashboard: where to start, not how
 * big everything is. Overdue requests first, then inquiries this user has taken, then what
 * is waiting, oldest first; only the queues this role can decide. Each row opens its queue.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, ArrowRight, CircleCheck, Inbox, UserCheck } from 'lucide-react';
import { can, type QueueCount } from '@tfd/domain';
import { useAuthStore, useCurrentUser } from '@/auth/authStore';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { formatAge, formatCount, hoursSince } from '@/lib/format';
import { qk } from '@/query/queryKeys';
import { inquiryRepository } from '@/services/repositories/inquiryRepository';
import { TODAY_LIMIT, queueLink, queueNavItem, todayItems, type TodayItem } from './today';

const OPEN_INQUIRIES = { status: ['open', 'escalated', 'awaitingSupplier'] as const, page: 0, pageSize: 100 };

export function TodayCard({ queues }: { queues: QueueCount[] }) {
  const { t } = useTranslation();
  const grants = useAuthStore((s) => s.grants);
  const user = useCurrentUser();
  const canAnswer = can(grants, 'inquiries', 'approve');

  // Inquiries this user has taken ("Assign to me"), still open.
  const inquiries = useQuery({
    queryKey: qk.inquiries.list(OPEN_INQUIRIES),
    queryFn: () => inquiryRepository.list(OPEN_INQUIRIES),
    enabled: canAnswer && Boolean(user),
  });
  const assigned = (inquiries.data?.items ?? []).filter(
    (one) => user && one.assignedToId === user.id,
  ).length;

  const canAct = (queue: QueueCount) => {
    const item = queueNavItem(queue.queue);
    return Boolean(item && can(grants, item.capability, 'approve'));
  };
  const items = todayItems(queues, canAct, assigned);
  const shown = items.slice(0, TODAY_LIMIT);

  return (
    <Card className="animate-rise">
      <CardHeader title={t('dashboard.today.title')} description={t('dashboard.today.description')} />
      <CardBody>
        {shown.length === 0 ? (
          <p className="flex items-center gap-sm rounded-md bg-success-muted px-md py-sm text-body-small text-text-primary">
            <CircleCheck className="size-icon-md shrink-0 text-success" aria-hidden />
            {t('dashboard.today.clear')}
          </p>
        ) : (
          <ol className="flex flex-col gap-xs">
            {shown.map((item, index) => (
              <TodayRow key={`${item.kind}-${'queue' in item ? item.queue.queue : 'me'}`} item={item} first={index === 0} />
            ))}
          </ol>
        )}
        {items.length > shown.length ? (
          <p className="mt-sm text-caption text-text-secondary">
            {t('dashboard.today.more', { count: items.length - shown.length })}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function TodayRow({ item, first }: { item: TodayItem; first: boolean }) {
  const { t } = useTranslation();
  const queueName = 'queue' in item ? t(`dashboard.queue.${item.queue.queue}`) : '';
  const to = 'queue' in item ? queueLink(item.queue.queue) : '/inquiries';
  const Icon = item.kind === 'overdue' ? AlarmClock : item.kind === 'assigned' ? UserCheck : (('queue' in item && queueNavItem(item.queue.queue)?.icon) || Inbox);
  const sentence =
    item.kind === 'overdue'
      ? t('dashboard.today.overdue', { count: formatCount(item.count), queue: queueName })
      : item.kind === 'assigned'
        ? t('dashboard.today.assigned', { count: formatCount(item.count) })
        : t('dashboard.today.waiting', { count: formatCount(item.count), queue: queueName });
  // How long the oldest has waited says more than a sentence repeated on every row.
  const hint =
    'queue' in item && item.queue.oldestPendingAt
      ? t('dashboard.oldestWaiting', { age: formatAge(hoursSince(item.queue.oldestPendingAt)) })
      : item.kind === 'assigned'
        ? t('dashboard.today.assignedHint')
        : undefined;

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          item.kind === 'overdue' ? 'bg-error-muted text-error' : 'bg-primary-muted text-primary',
        )}
      >
        <Icon className="size-icon-sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('text-body-small font-medium', item.kind === 'overdue' ? 'text-error' : 'text-text-primary')}>
          {sentence}
        </span>
        {hint ? <span className="text-caption text-text-secondary">{hint}</span> : null}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-xxs text-caption font-medium',
          first ? 'rounded-md bg-primary px-sm py-xxs text-primary-contrast' : 'text-primary',
        )}
      >
        {first ? t('dashboard.today.start') : t('dashboard.today.open')}
        <ArrowRight className="size-icon-xs" aria-hidden />
      </span>
    </>
  );

  return (
    <li>
      {to ? (
        <Link
          to={to}
          className="flex items-center gap-md rounded-md px-sm py-xs transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-md px-sm py-xs">{body}</div>
      )}
    </li>
  );
}
