/**
 * The supplier's history in one list (24 November 2026): bills, requests, change requests
 * and inquiries, newest first, grouped by month, each a link to its own screen. A filter
 * narrows it to one kind. Built from the lists the console already reads (`timeline.ts`),
 * and only from the ones this role may read: a kind it cannot open is not offered.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  ClipboardList,
  FileText,
  MessageSquare,
  Package,
  type LucideIcon,
} from 'lucide-react';
import {
  INQUIRY_STATUSES,
  type ChangeRequestQuery,
  type InquiryQuery,
  type RequestStatus,
} from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatAmount, formatDateTime, formatKg, formatMoney, formatMonthKey } from '@/lib/format';
import { qk } from '@/query/queryKeys';
import { changeRequestRepository } from '@/services/repositories/changeRequestRepository';
import { inquiryRepository } from '@/services/repositories/inquiryRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { useSupplierRequestHistory } from './hooks';
import {
  INQUIRY_TONES,
  REQUEST_TONES,
  buildTimeline,
  groupByMonth,
  type TimelineEvent,
  type TimelineKind,
} from './timeline';

const CHANGE_STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected'];
/** The largest page the lists serve. */
const PAGE = 100;
/** Months shown before "Show more". */
const FIRST_MONTHS = 6;

type Filter = 'all' | TimelineKind;

export function SupplierTimeline({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();
  const canCredit = useCan('creditRequests', 'read');
  const canChanges = useCan('changeRequests', 'read');
  const canInquiries = useCan('inquiries', 'read');
  const [filter, setFilter] = useState<Filter>('all');
  const [months, setMonths] = useState(FIRST_MONTHS);

  // The latest year of bills, and the one before when there is one.
  const latest = useQuery({
    queryKey: qk.suppliers.income(supplierId, undefined),
    queryFn: () => supplierRepository.income(supplierId, undefined),
  });
  const previousYear = latest.data?.years[1];
  const earlier = useQuery({
    queryKey: qk.suppliers.income(supplierId, previousYear),
    queryFn: () => supplierRepository.income(supplierId, previousYear),
    enabled: previousYear !== undefined,
  });

  const requests = useSupplierRequestHistory(canCredit ? supplierId : undefined);

  const changes = useQueries({
    queries: CHANGE_STATUSES.map((status) => {
      const query: ChangeRequestQuery = { status, supplierId, page: 0, pageSize: PAGE };
      return {
        queryKey: qk.changeRequests.list(query),
        queryFn: () => changeRequestRepository.list(query),
        enabled: canChanges,
      };
    }),
  });

  const inquiryQuery: InquiryQuery = { status: INQUIRY_STATUSES, supplierId, page: 0, pageSize: PAGE };
  const inquiries = useQuery({
    queryKey: qk.inquiries.list(inquiryQuery),
    queryFn: () => inquiryRepository.list(inquiryQuery),
    enabled: canInquiries,
  });

  const changeRows = changes.flatMap((one) => one.data?.items ?? []);
  // Cheap to rebuild: a few hundred rows at most, sorted once per render.
  const events = buildTimeline({
    supplierId,
    months: [...(latest.data?.months ?? []), ...(earlier.data?.months ?? [])],
    credit: canCredit ? requests.credit : [],
    teaPackets: canCredit ? requests.teaPackets : [],
    changes: changeRows,
    inquiries: inquiries.data?.items ?? [],
  });

  const filters: Filter[] = [
    'all',
    'bill',
    ...(canCredit ? (['request'] as const) : []),
    ...(canChanges ? (['change'] as const) : []),
    ...(canInquiries ? (['inquiry'] as const) : []),
  ];
  const shown = filter === 'all' ? events : events.filter((event) => event.kind === filter);
  const groups = groupByMonth(shown);
  const visible = groups.slice(0, months);

  const loading = latest.isPending || (canCredit && requests.isPending) || (canInquiries && inquiries.isPending);

  if (latest.error) return <ErrorState error={latest.error} onRetry={() => void latest.refetch()} />;

  return (
    <Card>
      <CardHeader
        title={t('suppliers.timeline.title')}
        description={t('suppliers.timeline.description')}
      />
      <CardBody className="flex flex-col gap-lg">
        <div role="group" aria-label={t('suppliers.timeline.filterLabel')} className="flex flex-wrap gap-xs">
          {filters.map((one) => {
            const count = one === 'all' ? events.length : events.filter((event) => event.kind === one).length;
            return (
              <button
                key={one}
                type="button"
                aria-pressed={filter === one}
                onClick={() => {
                  setFilter(one);
                  setMonths(FIRST_MONTHS);
                }}
                className={cn(
                  'inline-flex min-h-8 items-center gap-xs rounded-full border px-md text-body-small font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  filter === one
                    ? 'border-primary bg-primary-muted text-primary'
                    : 'border-border bg-surface text-text-primary hover:border-primary',
                )}
              >
                {t(`suppliers.timeline.filter.${one}`)}
                <span className="numeric text-caption text-text-secondary">{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col gap-sm">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title={t('suppliers.timeline.empty')} />
        ) : (
          <ol className="flex flex-col gap-lg">
            {visible.map((group) => (
              <li key={group.monthKey} className="flex flex-col gap-sm">
                <h3 className="text-caption font-semibold tracking-wide text-text-secondary uppercase">
                  {formatMonthKey(group.monthKey)}
                </h3>
                <ol className="flex flex-col gap-xxs">
                  {group.events.map((event) => (
                    <TimelineRow key={event.id} event={event} />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}

        {groups.length > visible.length ? (
          <Button variant="secondary" size="sm" className="self-center" onClick={() => setMonths((n) => n + FIRST_MONTHS)}>
            {t('suppliers.timeline.more')}
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

const ICONS: Record<TimelineKind, LucideIcon> = {
  bill: FileText,
  request: BadgeDollarSign,
  change: ClipboardList,
  inquiry: MessageSquare,
};

/** One event: an icon on the line, what happened, its state, and where it opens. */
function TimelineRow({ event }: { event: TimelineEvent }) {
  const { t } = useTranslation();
  const canBills = useCan('billing', 'read');
  const row = describe(event, t);
  const Icon = 'teaPacket' in event ? Package : ICONS[event.kind];
  const to = event.kind === 'bill' && !canBills ? undefined : row.to;
  const body = (
    <>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-variant text-text-secondary"
      >
        <Icon className="size-icon-sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-small font-medium text-text-primary">{row.title}</span>
        {row.detail ? <span className="truncate text-caption text-text-secondary">{row.detail}</span> : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-xxs">
        {row.status ? <Badge tone={row.status.tone}>{row.status.label}</Badge> : null}
        <span className="text-caption text-text-secondary">{row.when}</span>
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

type T = (key: string, options?: Record<string, unknown>) => string;

function describe(
  event: TimelineEvent,
  t: T,
): { title: string; detail?: string; status?: { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }; when: string; to?: string } {
  switch (event.kind) {
    case 'bill': {
      const { month } = event;
      return {
        title: t('suppliers.timeline.bill', { month: formatMonthKey(month.monthKey) }),
        detail: month.auctionResultAvailable
          ? `${formatKg(month.totalKgs)} · ${formatMoney(month.finalBalance)}`
          : `${formatKg(month.totalKgs)} · ${t('suppliers.income.pending')}`,
        status: month.auctionResultAvailable
          ? undefined
          : { label: t('suppliers.income.pending'), tone: 'warning' },
        when: formatMonthKey(month.monthKey),
        to: month.billId ? `/bills/${month.billId}` : undefined,
      };
    }
    case 'request': {
      if ('credit' in event) {
        const { credit } = event;
        return {
          title: t('suppliers.timeline.credit', { facility: t(`credit.facility.${credit.facility}`) }),
          detail: credit.decision
            ? `${formatMoney(credit.amount)} · ${t('suppliers.timeline.decidedBy', { name: credit.decision.decidedByName })}`
            : formatMoney(credit.amount),
          status: { label: t(`credit.status.${credit.status}`), tone: REQUEST_TONES[credit.status] },
          when: formatDateTime(credit.createdAt),
          to: `/credit/${credit.id}`,
        };
      }
      const { teaPacket } = event;
      return {
        title: t('suppliers.timeline.teaPackets', { count: teaPacket.packets }),
        detail: `LKR ${formatAmount(teaPacket.amount)}`,
        status: { label: t(`teaPackets.status.${teaPacket.status}`), tone: REQUEST_TONES[teaPacket.status] },
        when: formatDateTime(teaPacket.createdAt),
        // The queue narrowed to this supplier and status, not the whole queue.
        to: `/tea-packets?supplierId=${teaPacket.supplierId}&status=${teaPacket.status}`,
      };
    }
    case 'change':
      return {
        title: t('suppliers.timeline.change', { type: t(`changeRequests.type.${event.change.type}`) }),
        detail: event.change.requestedSummary,
        status: {
          label: t(`changeRequests.status.${event.change.status}`),
          tone: REQUEST_TONES[event.change.status],
        },
        when: formatDateTime(event.change.createdAt),
        to: `/change-requests/${event.change.id}`,
      };
    case 'inquiry':
      return {
        title: event.inquiry.subject,
        detail: t('suppliers.timeline.inquiry'),
        status: {
          label: t(`inquiries.status.${event.inquiry.status}`),
          tone: INQUIRY_TONES[event.inquiry.status],
        },
        when: formatDateTime(event.inquiry.createdAt),
        to: `/inquiries/${event.inquiry.id}`,
      };
  }
}
