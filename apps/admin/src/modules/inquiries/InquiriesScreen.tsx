/**
 * M10 Inquiries — the supplier's messages to the office.
 *
 * The module that completes the console's promise: **every `pending` in the app is
 * a queue here**. It is also the only queue whose rows are prose, which changes the
 * grid: the subject is the column a clerk triages on, so it gets the width, and the
 * first line of the message sits under it. Reading "July account is short" is what
 * decides whether this is answered now or after lunch — a row showing only a
 * supplier code and a date would make every message look the same.
 *
 * Oldest first within a status, like every other inbox. The default filter is
 * `open`, because the answered ones are a record and the open ones are work.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { AdminInquiry, InquiryStatus } from '@tfd/domain';
import { QUEUE_SLA_HOURS } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { useDebounced } from '@/lib/useDebounced';
import { formatAge } from '@/lib/format';
import { useInquiries } from './hooks';

const STATUS_TONES = { open: 'warning', resolved: 'success', closed: 'neutral' } as const;

export function InquiriesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);

  const status = (params.get('status') as InquiryStatus | null) ?? 'open';
  const supplierId = params.get('supplierId');
  const page = Number(params.get('page') ?? 0);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'ageHours', desc: true }]);

  const query = useMemo(
    () => ({
      status,
      supplierId: supplierId ?? undefined,
      q: debouncedSearch || undefined,
      page,
      pageSize: 25,
      sort: sorting[0]?.id ?? 'ageHours',
      dir: sorting[0]?.desc ? ('desc' as const) : ('asc' as const),
    }),
    [status, supplierId, debouncedSearch, page, sorting],
  );

  const { data, isPending, error, refetch } = useInquiries(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  function handleSortingChange(next: SortingState) {
    setSorting(next);
    setParam('page', null);
  }

  const columns = useMemo<ColumnDef<AdminInquiry, unknown>[]>(
    () => [
      {
        accessorKey: 'supplierCode',
        header: t('changeRequests.column.supplier'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="numeric font-semibold text-text-primary">{row.supplierCode}</span>
              <span className="text-caption text-text-secondary">{row.supplierName}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'subject',
        header: t('inquiries.column.subject'),
        cell: (info) => {
          const row = info.row.original;
          return (
            // Bounded, and the preview clamped to one line: the message is here to
            // be triaged from, not read in full, and an unbounded prose column
            // pushes the age badge — the other thing this grid is scanned for —
            // off a laptop screen.
            <span className="flex max-w-card flex-col">
              <span className="font-medium text-text-primary">{row.subject}</span>
              <span className="line-clamp-1 text-caption text-text-secondary">{row.message}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'channel',
        header: t('changeRequests.column.channel'),
        enableSorting: false,
        cell: (info) => (
          <span className="text-caption text-text-secondary">
            {t(`changeRequests.channel.${info.getValue<'app' | 'office'>()}`)}
          </span>
        ),
      },
      {
        accessorKey: 'ageHours',
        header: t('changeRequests.column.age'),
        cell: (info) => {
          const hours = info.getValue<number>();
          const row = info.row.original;
          if (row.status !== 'open') {
            return (
              <Badge tone={STATUS_TONES[row.status]}>{t(`inquiries.status.${row.status}`)}</Badge>
            );
          }
          return (
            <Badge tone={hours > QUEUE_SLA_HOURS.inquiries ? 'error' : 'neutral'}>
              {formatAge(hours)}
            </Badge>
          );
        },
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader title={t('inquiries.title')} description={t('inquiries.subtitle')} />

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
          <div className="min-w-64 flex-1">
            <SearchInput
              label={t('inquiries.searchPlaceholder')}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setParam('q', event.target.value || null);
              }}
            />
          </div>

          <Select
            aria-label={t('common.status')}
            value={status}
            onChange={(event) => setParam('status', event.target.value)}
            fullWidth={false}
          >
            <option value="open">{t('inquiries.filter.open')}</option>
            <option value="resolved">{t('inquiries.filter.resolved')}</option>
            <option value="closed">{t('inquiries.filter.closed')}</option>
          </Select>
        </div>

        <DataTable
          label={t('inquiries.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/inquiries/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          emptyState={
            <EmptyState
              title={status === 'open' ? t('inquiries.empty') : t('common.noResults')}
              body={status === 'open' ? t('inquiries.emptyHint') : t('common.noResultsHint')}
            />
          }
        />
      </Card>
    </>
  );
}
