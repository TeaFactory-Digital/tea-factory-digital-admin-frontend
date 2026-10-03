/**
 * M11 Promo banners — the list.
 *
 * **The column that decides this screen's shape is `window`, not `status`.** An article
 * is published or it is not; a banner has a status *and* a live window, and the two
 * disagree constantly — a published banner scheduled for next week is in front of nobody,
 * and a published banner whose `endsAt` passed on Tuesday is equally invisible while
 * still reading "published" everywhere.
 *
 * So the default lens is **live**, because "what are suppliers being shown right now" is
 * the question the office actually arrives with, and it is the one question a status
 * column cannot answer. Expired rows are kept rather than hidden: a banner that ran is
 * how the office writes the next one.
 *
 * The window state is the server's (`BannerListItem.window`), not computed here. A
 * console reading the browser's clock would disagree with the phone on the day a banner
 * starts — and would disagree differently on every machine in the office.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { CircleAlert, ImageOff, Plus } from 'lucide-react';
import type { BannerListItem, BannerQuery, ContentStatus } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { useDebounced } from '@/lib/useDebounced';
import { formatDateTime } from '@/lib/format';
import { NewBannerDialog } from './NewBannerDialog';
import { useBanners } from './hooks';

const STATUS_TONES: Record<ContentStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'neutral',
};

/**
 * `live` is the only one that is good news, `scheduled` is neutral, and `expired` is
 * neutral rather than an error — a banner that finished its run did what it was for.
 */
const WINDOW_TONES: Record<BannerListItem['window'], BadgeTone> = {
  scheduled: 'info',
  live: 'success',
  expired: 'neutral',
};

type Lens = 'live' | 'scheduled' | 'expired' | 'draft' | 'all';

export function BannersScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canWrite = useCan('content', 'write');

  const lens = (params.get('lens') as Lens | null) ?? 'live';
  const page = Number(params.get('page') ?? 0);

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);
  const [creating, setCreating] = useState(false);

  const query = useMemo<BannerQuery>(
    () => ({
      status: lens === 'draft' ? 'draft' : undefined,
      window: lens === 'live' || lens === 'scheduled' || lens === 'expired' ? lens : undefined,
      q: debouncedSearch || undefined,
      page,
      pageSize: 25,
    }),
    [lens, debouncedSearch, page],
  );

  const { data, isPending, error, refetch } = useBanners(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<BannerListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('banners.column.title'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex items-center gap-sm">
              <ArtworkThumb url={row.imageUrl ?? null} hasImage={row.hasImage} />
              <span className="font-medium text-text-primary">
                {row.title || t('banners.untitled')}
              </span>
              {row.missingLanguages.length > 0 ? (
                <span className="inline-flex items-center text-warning">
                  <CircleAlert className="size-icon-xs" aria-hidden />
                  <span className="sr-only">
                    {t('banners.missingCount', { count: row.missingLanguages.length })}
                  </span>
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'window',
        header: t('banners.column.window'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col gap-xxs">
              <Badge tone={WINDOW_TONES[row.window]}>{t(`banners.window.${row.window}`)}</Badge>
              <span className="numeric text-caption text-text-secondary">
                {formatDateTime(row.startsAt)}
                {row.endsAt ? ` → ${formatDateTime(row.endsAt)}` : ` → ${t('banners.noEnd')}`}
              </span>
            </span>
          );
        },
      },
      {
        // Where the button goes. The one fact about a banner that cannot be seen from its
        // headline, and the one most often got wrong.
        id: 'action',
        header: t('banners.action.kind'),
        enableSorting: false,
        cell: (info) => {
          const action = info.row.original.action;
          if (!action) return <span className="text-text-secondary">—</span>;
          return action.type === 'url' ? (
            <span className="flex max-w-56 flex-col">
              <span className="text-caption text-text-secondary">{t('banners.action.url')}</span>
              <span className="truncate text-body-small text-text-primary" title={action.url}>
                {action.url}
              </span>
            </span>
          ) : (
            <span className="flex flex-col">
              <span className="text-caption text-text-secondary">{t('banners.action.screen')}</span>
              <span className="numeric text-body-small text-text-primary">{action.path}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: (info) => {
          const status = info.getValue<ContentStatus>();
          return <Badge tone={STATUS_TONES[status]}>{t(`banners.status.${status}`)}</Badge>;
        },
      },
      {
        accessorKey: 'missingLanguages',
        header: t('banners.column.languages'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          const missing = row.missingLanguages;
          const stale = row.staleLanguages ?? [];
          if (missing.length === 0 && stale.length === 0) {
            return (
              <span className="text-caption text-text-secondary">{t('banners.complete')}</span>
            );
          }
          // Out of date first, as on the news list: it is the worse failure, and the one
          // that looks fine on the phone.
          return (
            <span className="flex flex-wrap gap-xs">
              {stale.map((lang) => (
                <Badge key={`stale-${lang}`} tone="error">
                  {t('content.badge.stale', { language: t(`content.language.${lang}`) })}
                </Badge>
              ))}
              {missing.map((lang) => (
                <Badge key={`missing-${lang}`} tone="warning">
                  {t('content.badge.missing', { language: t(`content.language.${lang}`) })}
                </Badge>
              ))}
            </span>
          );
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('common.updated'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="numeric whitespace-nowrap text-text-secondary">
                {formatDateTime(row.updatedAt)}
              </span>
              <span className="text-caption text-text-secondary">{row.updatedByName}</span>
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('banners.title')}
        description={t('banners.subtitle')}
        actions={
          canWrite ? (
            <Button
              variant="primary"
              iconLeft={<Plus className="size-icon-sm" aria-hidden />}
              onClick={() => setCreating(true)}
            >
              {t('banners.create')}
            </Button>
          ) : null
        }
      />

      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
          <div className="min-w-64 flex-1">
            <SearchInput
              label={t('banners.searchPlaceholder')}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setParam('q', event.target.value || null);
              }}
            />
          </div>

          <Select
            aria-label={t('content.lens')}
            value={lens}
            onChange={(event) =>
              setParam('lens', event.target.value === 'live' ? null : event.target.value)
            }
            fullWidth={false}
          >
            {/* Live first and by default: it is the question the office arrives with. */}
            <option value="live">{t('banners.window.live')}</option>
            <option value="scheduled">{t('banners.window.scheduled')}</option>
            <option value="expired">{t('banners.window.expired')}</option>
            <option value="draft">{t('banners.status.draft')}</option>
            <option value="all">{t('banners.lens.all')}</option>
          </Select>
        </div>

        <DataTable
          label={t('banners.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/banners/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          emptyState={
            <EmptyState
              title={lens === 'live' ? t('banners.noneLive') : t('banners.empty')}
              body={lens === 'live' ? t('banners.noneLiveHint') : t('banners.emptyHint')}
            />
          }
        />
      </Card>

      <NewBannerDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(`/banners/${id}`)}
      />
    </>
  );
}

/**
 * The artwork, small enough to sit beside a headline, in the banner's own wide shape.
 * The URL is signed and short-lived, so a broken thumbnail falls back to the "no
 * artwork" icon instead of the browser's broken-image glyph.
 */
function ArtworkThumb({ url, hasImage }: { url: string | null; hasImage: boolean }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex h-10 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-variant text-text-secondary">
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <ImageOff className="size-icon-sm" aria-hidden />
          {!hasImage ? <span className="sr-only">{t('banners.noArtwork')}</span> : null}
        </>
      )}
    </span>
  );
}
