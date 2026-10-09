/**
 * The bell at the top right: what is waiting, and what suppliers just did.
 *
 * Two halves, because they answer two questions. **Waiting for you** is the queues, from
 * the dashboard summary the shell already fetched, oldest-overdue first, each a link into
 * its queue. **Recent activity** is the feed of supplier actions (`activity.ts`), with a
 * dot on what this user has not seen; closing the bell marks it read, for them only.
 *
 * The badge counts the unread activity. While the server has no feed it counts what is
 * waiting instead, so the bell never shows a calm zero over a full inbox.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  BadgeDollarSign,
  Bell,
  ClipboardList,
  Inbox,
  MessageSquare,
  Package,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityItem, CreditFacility, QueueCount } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { cn } from '@/lib/cn';
import { formatAge, formatAmount, hoursSince } from '@/lib/format';
import type { DashboardView } from '@/services/repositories/dashboardRepository';
import { NAVIGATION, queuesOf } from './navigation';
import { useActivity, useMarkActivityRead } from './useActivity';

/** The queue screen narrows to one facility, as the dashboard's cards do. */
const QUEUE_FACILITY: Partial<Record<QueueCount['queue'], CreditFacility>> = {
  advanceRequests: 'advance',
  loanRequests: 'loan',
  manureRequests: 'manure',
};

/** Where each activity opens, and its icon. Tea packets have no detail screen. */
function activityTarget(item: ActivityItem): { to: string; icon: LucideIcon } {
  switch (item.kind) {
    case 'creditRequest.created':
    case 'creditRequest.cancelled':
      return { to: `/credit/${item.entityId}`, icon: BadgeDollarSign };
    case 'teaPacket.created':
    case 'teaPacket.cancelled':
      return { to: '/tea-packets', icon: Package };
    case 'changeRequest.created':
      return { to: `/change-requests/${item.entityId}`, icon: ClipboardList };
    case 'inquiry.created':
    case 'inquiry.replied':
      return { to: `/inquiries/${item.entityId}`, icon: MessageSquare };
    case 'supplier.appDeletionRequested':
      return { to: `/suppliers/${item.supplierId}`, icon: UserX };
  }
}

export function NotificationBell({ summary }: { summary?: DashboardView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activity = useActivity();
  const markRead = useMarkActivityRead();

  const feed = activity.data;
  const waiting = (summary?.queues ?? [])
    .filter((queue) => queue.pending > 0)
    .sort(
      (a, b) =>
        b.breachingSla - a.breachingSla ||
        (a.oldestPendingAt ?? '').localeCompare(b.oldestPendingAt ?? ''),
    );
  const waitingTotal = waiting.reduce((sum, queue) => sum + queue.pending, 0);
  const badge = feed ? feed.unread : waitingTotal;

  /** Closing the bell is reading it: everything up to the newest item shown. */
  function onOpenChange(next: boolean) {
    setOpen(next);
    const newest = feed?.items[0]?.at;
    if (!next && feed && feed.unread > 0 && newest) markRead.mutate(newest);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            badge > 0 ? t('bell.labelWithCount', { count: badge }) : t('bell.label')
          }
          className="relative flex size-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary shadow-card transition-colors hover:border-text-secondary hover:text-text-primary"
        >
          <Bell className="size-icon-sm" aria-hidden />
          {badge > 0 ? (
            <span className="numeric absolute -top-xs -right-xs flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-xxs text-caption font-semibold text-on-status">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between gap-sm border-b border-divider px-lg py-md">
          <p className="text-subtitle font-semibold text-text-primary">{t('bell.title')}</p>
          {feed && feed.unread > 0 && feed.items[0] ? (
            <button
              type="button"
              onClick={() => markRead.mutate(feed.items[0]!.at)}
              className="text-caption font-medium text-primary hover:underline"
            >
              {t('bell.markAllRead')}
            </button>
          ) : null}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {/* ── What is waiting ─────────────────────────────────────────── */}
          <section className="px-lg py-md">
            <p className="pb-xs text-caption font-medium uppercase tracking-wide text-text-secondary">
              {t('bell.waiting')}
            </p>
            {waiting.length === 0 ? (
              <p className="text-body-small text-text-secondary">{t('bell.nothingWaiting')}</p>
            ) : (
              <ul className="flex flex-col">
                {waiting.map((queue) => (
                  <QueueRow key={queue.queue} queue={queue} onNavigate={() => onOpenChange(false)} />
                ))}
              </ul>
            )}
          </section>

          {/* ── What suppliers just did ─────────────────────────────────── */}
          <section className="border-t border-divider px-lg py-md">
            <p className="pb-xs text-caption font-medium uppercase tracking-wide text-text-secondary">
              {t('bell.recent')}
            </p>
            {activity.isPending ? (
              <p className="text-body-small text-text-secondary">{t('common.loading')}</p>
            ) : !feed ? (
              <p className="text-body-small text-text-secondary">{t('bell.feedUnavailable')}</p>
            ) : feed.items.length === 0 ? (
              <p className="text-body-small text-text-secondary">{t('bell.noActivity')}</p>
            ) : (
              <ul className="flex flex-col">
                {feed.items.map((item) => (
                  <ActivityRow key={item.id} item={item} onNavigate={() => onOpenChange(false)} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function QueueRow({ queue, onNavigate }: { queue: QueueCount; onNavigate: () => void }) {
  const { t } = useTranslation();
  const target = NAVIGATION.flatMap((section) => section.items).find((item) =>
    queuesOf(item).includes(queue.queue),
  );
  const Icon = target?.icon ?? Inbox;
  const search = new URLSearchParams({ status: 'pending' });
  const facility = QUEUE_FACILITY[queue.queue];
  if (facility) search.set('facility', facility);

  const body = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-variant text-text-secondary">
        <Icon className="size-icon-sm" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-small font-medium text-text-primary">
          {t(`dashboard.queue.${queue.queue}`)}
        </span>
        {queue.oldestPendingAt ? (
          <span className="text-caption text-text-secondary">
            {t('dashboard.oldestWaiting', { age: formatAge(hoursSince(queue.oldestPendingAt)) })}
          </span>
        ) : null}
      </span>
      {queue.breachingSla > 0 ? (
        <Badge tone="error">{t('dashboard.slaBreaching', { count: queue.breachingSla })}</Badge>
      ) : null}
      <span className="numeric text-subtitle font-semibold text-text-primary">{queue.pending}</span>
    </>
  );

  return (
    <li>
      {target ? (
        <Link
          to={`${target.to}?${search}`}
          onClick={onNavigate}
          className="-mx-sm flex items-center gap-sm rounded-md px-sm py-xs hover:bg-surface-variant"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-sm py-xs">{body}</div>
      )}
    </li>
  );
}

function ActivityRow({ item, onNavigate }: { item: ActivityItem; onNavigate: () => void }) {
  const { t } = useTranslation();
  const { to, icon: Icon } = activityTarget(item);
  const values = {
    name: item.supplierName,
    code: item.supplierCode,
    facility: item.facility ? t(`credit.facility.${item.facility}`) : '',
    amount: item.amount !== undefined ? formatAmount(item.amount) : '',
    change: item.changeType ? t(`changeRequests.type.${item.changeType}`) : '',
    subject: item.subject ?? '',
  };

  return (
    <li>
      <Link
        to={to}
        onClick={onNavigate}
        className="-mx-sm flex items-start gap-sm rounded-md px-sm py-xs hover:bg-surface-variant"
      >
        <span
          className={cn(
            'mt-xxs flex size-7 shrink-0 items-center justify-center rounded-md',
            item.unread ? 'bg-primary-muted text-primary' : 'bg-surface-variant text-text-secondary',
          )}
        >
          <Icon className="size-icon-sm" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'text-body-small',
              item.unread ? 'font-medium text-text-primary' : 'text-text-secondary',
            )}
          >
            {t(`bell.kind.${item.kind}`, values)}
          </span>
          <span className="text-caption text-text-secondary">
            {item.supplierCode} · {t('bell.ago', { age: formatAge(hoursSince(item.at)) })}
          </span>
        </span>
        {item.unread ? (
          <span className="mt-sm size-2 shrink-0 rounded-full bg-primary" aria-label={t('bell.unread')} />
        ) : null}
      </Link>
    </li>
  );
}
