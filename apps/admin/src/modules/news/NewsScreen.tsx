/**
 * M11 News — the factory's feed.
 *
 * A grid rather than a card wall, because the question the office brings to this screen is
 * not "what have we published" — it is **"what is live and wrong"**. So the two columns
 * that carry the most are the status and the language gaps, and *Live with a gap* is a
 * filter rather than something to spot: an article published three weeks ago that a
 * Sinhala supplier is still reading in English will never be found by scrolling.
 *
 * That filter is AC-08's working list, in the same sense that M4's exception queue is
 * AC-04's. A criterion satisfied by a warning nobody has a way to enumerate is satisfied
 * on paper only.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import type { ContentStatus, LanguageCode, NewsListItem, NewsQuery } from '@tfd/domain';
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
import { NewArticleDialog } from './NewArticleDialog';
import { useNewsList } from '@/modules/content/hooks';

const STATUS_TONES: Record<ContentStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'neutral',
};

type Lens = 'all' | ContentStatus | 'incomplete';

export function NewsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canWrite = useCan('content', 'write');

  const lens = (params.get('lens') as Lens | null) ?? 'all';
  const page = Number(params.get('page') ?? 0);

  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(searchText, 250);
  const [creating, setCreating] = useState(false);

  const query = useMemo<NewsQuery>(
    () => ({
      status:
        lens === 'draft' || lens === 'published' || lens === 'archived' ? lens : undefined,
      incomplete: lens === 'incomplete' || undefined,
      q: debouncedSearch || undefined,
      page,
      pageSize: 25,
    }),
    [lens, debouncedSearch, page],
  );

  const { data, isPending, error, refetch } = useNewsList(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<NewsListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('news.column.title'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            // The **fallback** title, always — a list whose titles changed with a
            // selected language would be unreadable while translating.
            <span className="flex max-w-card flex-col">
              <span className="font-medium text-text-primary">{row.title}</span>
              <span className="numeric text-caption text-text-secondary">{row.slug}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: (info) => (
          <Badge tone={STATUS_TONES[info.getValue<ContentStatus>()]}>
            {t(`news.status.${info.getValue<ContentStatus>()}`)}
          </Badge>
        ),
      },
      {
        id: 'languages',
        header: t('content.column.languages'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (row.missingLanguages.length === 0 && row.staleLanguages.length === 0) {
            return <Badge tone="success">{t('content.complete')}</Badge>;
          }
          return (
            <span className="flex flex-wrap items-center gap-xs">
              {/* Stale first: it is the worse failure and the one that looks fine in
                  the app, so it is the one that has to be read first here. */}
              {row.staleLanguages.map((lang: LanguageCode) => (
                <Badge key={`stale-${lang}`} tone="error">
                  {t('content.badge.stale', { language: t(`content.language.${lang}`) })}
                </Badge>
              ))}
              {row.missingLanguages.map((lang: LanguageCode) => (
                <Badge key={`missing-${lang}`} tone="warning">
                  {t('content.badge.missing', { language: t(`content.language.${lang}`) })}
                </Badge>
              ))}
            </span>
          );
        },
      },
      {
        accessorKey: 'publishedAt',
        header: t('news.column.published'),
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue<string | null>();
          return (
            <span className="numeric whitespace-nowrap text-text-secondary">
              {value ? formatDateTime(value) : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('content.column.lastEdit'),
        enableSorting: false,
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
        title={t('news.title')}
        description={t('news.subtitle')}
        actions={
          canWrite ? (
            <Button
              variant="primary"
              iconLeft={<Plus className="size-icon-sm" aria-hidden />}
              onClick={() => setCreating(true)}
            >
              {t('news.create')}
            </Button>
          ) : null
        }
      />

      <Card className={GRID_CARD}>
        <div className="flex shrink-0 flex-wrap items-center gap-sm border-b border-divider p-md">
          <div className="min-w-64 flex-1">
            <SearchInput
              label={t('news.searchPlaceholder')}
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
              setParam('lens', event.target.value === 'all' ? null : event.target.value)
            }
            fullWidth={false}
          >
            <option value="all">{t('news.lens.all')}</option>
            <option value="published">{t('news.status.published')}</option>
            <option value="draft">{t('news.status.draft')}</option>
            <option value="archived">{t('news.status.archived')}</option>
            {/* AC-08's working list: live, and falling back for somebody. */}
            <option value="incomplete">{t('news.lens.incomplete')}</option>
          </Select>
        </div>

        <DataTable
          label={t('news.title')}
          columns={columns}
          page={data}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          getRowId={(row) => row.id}
          onRowActivate={(row) => navigate(`/news/${row.id}`)}
          onPageChange={(next) => setParam('page', String(next))}
          emptyState={
            <EmptyState
              title={lens === 'incomplete' ? t('news.noIncomplete') : t('news.empty')}
              body={lens === 'incomplete' ? t('news.noIncompleteHint') : t('news.emptyHint')}
            />
          }
        />
      </Card>

      <NewArticleDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(`/news/${id}`)}
      />
    </>
  );
}
