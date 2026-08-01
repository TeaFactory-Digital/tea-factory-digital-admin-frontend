/**
 * M13 Notifications — what the factory has told suppliers, and what it tells them
 * automatically.
 *
 * **The log is the screen and the triggers are context**, and the layout has to say so on
 * a 13-inch laptop as well as on a monitor. A push is the only act in this console with no
 * undo and no delivery report, so the record of what went out is the primary artefact — a
 * screen that led with toggles would be a preferences page for a thing nobody could audit.
 *
 * That principle was stated here and then contradicted by the markup. The triggers card
 * sat *above* the grid in a column that fills the window, so on a short viewport the grid
 * absorbed every missing pixel and collapsed: measured at 1440×785 the list was 28 px
 * tall, and at 1440×700 it was zero. The rows were in the DOM the whole time, clipped by a
 * zero-height scroller — which is why nothing errored and why the browser test passed.
 *
 * Two changes, and the first is the real one:
 *
 *  - **The log comes first in the DOM and takes the wide column.** Above `lg` the triggers
 *    move beside it rather than in front of it, so the settings can be as tall as they
 *    need without costing the list a row. Below `lg` — where the sidebar has already
 *    collapsed, so the window is a tablet rather than a laptop — they stack
 *    *underneath*, which keeps reading and tab order the same at every width.
 *  - **The grid card has a floor** (`GRID_CARD`), so when the window genuinely cannot fit
 *    everything the page scrolls instead of the list vanishing.
 *
 * Every row carries **reached and suppressed side by side**, because one figure without
 * the other is misleading in the direction that matters. "Sent to 3" next to "11 opted
 * out" tells the office their circular did not work and a noticeboard would; "sent to 3"
 * alone reads as a small audience.
 *
 * Automatic and composed sends are **one list**, filterable rather than separated. They
 * answer different questions — "did the bill notification go out" and "who told everybody
 * the factory is closed" — but a supplier ringing about a message they received does not
 * know which kind it was.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Send } from 'lucide-react';
import type { NotificationOrigin, NotificationQuery, NotificationSend } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { formatCount, formatDateTime } from '@/lib/format';
import { ComposeDialog } from './ComposeDialog';
import { TriggersCard } from './TriggersCard';
import { useNotifications, useNotificationTriggers } from './hooks';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const canSend = useCan('content', 'approve');

  const origin = params.get('origin') as NotificationOrigin | null;
  const page = Number(params.get('page') ?? 0);
  const [composing, setComposing] = useState(false);

  const triggers = useNotificationTriggers();

  const query = useMemo<NotificationQuery>(
    () => ({ origin: origin ?? undefined, page, pageSize: 25 }),
    [origin, page],
  );
  const sends = useNotifications(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<NotificationSend, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('notifications.column.message'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex max-w-card flex-col">
              <span className="font-medium text-text-primary">{row.title}</span>
              <span className="line-clamp-1 text-caption text-text-secondary">{row.body}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'category',
        header: t('notifications.column.category'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col gap-xxs">
              <Badge tone="neutral">{t(`notifications.category.${row.category}`)}</Badge>
              {/* Automatic sends say what fired them. A log entry nobody can trace to an
                  action is a log entry nobody trusts. */}
              <span className="text-caption text-text-secondary">
                {row.origin === 'automatic'
                  ? t('notifications.firedBy')
                  : t('notifications.composedBy', { name: row.createdByName ?? '—' })}
              </span>
            </span>
          );
        },
      },
      {
        id: 'audience',
        header: t('notifications.column.audience'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="text-text-primary">
              {row.audience.kind === 'collectionPoint'
                ? t('notifications.audience.collectionPoint', {
                    point: row.audience.collectionPoint ?? '',
                  })
                : row.audience.kind === 'supplier'
                  ? t('notifications.audience.supplier')
                  : t('notifications.audience.allSuppliers')}
            </span>
          );
        },
      },
      {
        id: 'reach',
        header: t('notifications.column.reach'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="numeric font-semibold text-text-primary">
                {t('notifications.reachedDevices', {
                  count: formatCount(row.reachableDevices),
                })}
              </span>
              {/* Beside it, always. One figure without the other is misleading in the
                  direction that matters. */}
              {row.suppressedDevices > 0 ? (
                <span className="numeric text-caption text-warning">
                  {t('notifications.optedOutDevices', {
                    count: formatCount(row.suppressedDevices),
                  })}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('common.when'),
        enableSorting: false,
        cell: (info) => (
          <span className="numeric whitespace-nowrap text-text-secondary">
            {formatDateTime(info.getValue<string>())}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.subtitle')}
        actions={
          canSend ? (
            <Button
              variant="primary"
              iconLeft={<Send className="size-icon-sm" aria-hidden />}
              onClick={() => setComposing(true)}
            >
              {t('notifications.compose')}
            </Button>
          ) : null
        }
      />

      {/**
       * The log first, the settings beside it.
       *
       * `min-h-0` on the grid container is what lets the **card's** floor decide the
       * height rather than the container's content: without it the container inherits
       * `min-height: auto` from its own children and stops being able to shrink at all,
       * which turns every screen into a scrolling one even when there is room.
       */}
      <div className="grid min-h-0 flex-1 gap-lg lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className={GRID_CARD}>
          <div className="flex shrink-0 flex-wrap items-end gap-sm border-b border-divider p-md">
            <label className="flex flex-col gap-xs text-label text-text-primary">
              {t('notifications.filterLabel')}
              <Select
                value={origin ?? 'all'}
                onChange={(event) =>
                  setParam('origin', event.target.value === 'all' ? null : event.target.value)
                }
                fullWidth={false}
              >
                <option value="all">{t('notifications.filter.all')}</option>
                <option value="automatic">{t('notifications.filter.automatic')}</option>
                <option value="composed">{t('notifications.filter.composed')}</option>
              </Select>
            </label>

            <p className="pb-sm text-caption text-text-secondary">
              {/* The app drops an unrecognized category, so there is no delivery report to
                  show. Said once, on the log, rather than implied by its absence. */}
              {t('notifications.noDeliveryReports')}
            </p>
          </div>

          <DataTable
            label={t('notifications.title')}
            columns={columns}
            page={sends.data}
            loading={sends.isPending}
            error={sends.error}
            onRetry={() => void sends.refetch()}
            getRowId={(row) => row.id}
            onPageChange={(next) => setParam('page', String(next))}
            emptyState={
              <EmptyState title={t('notifications.empty')} body={t('notifications.emptyHint')} />
            }
          />
        </Card>

        {/**
         * The settings column scrolls on its own above `lg`.
         *
         * Otherwise a tall triggers card would push the page into a scroll even when the
         * log fits perfectly — the reader would be scrolling the whole screen to reach a
         * paragraph, and losing the list to do it.
         */}
        <div className="flex min-h-0 flex-col gap-lg lg:overflow-y-auto">
          <TriggersCard />

          {/* M11 is where the copy lives; this module only carries the headline. Linked so
              the office is not tempted to write an article into a push. */}
          <p className="text-caption text-text-secondary">
            {t('notifications.useNewsHint')}{' '}
            <Link to="/news" className="text-primary underline-offset-2 hover:underline">
              {t('nav.news')}
            </Link>
          </p>
        </div>
      </div>

      <ComposeDialog
        open={composing}
        onClose={() => setComposing(false)}
        triggers={triggers.data}
      />
    </>
  );
}
