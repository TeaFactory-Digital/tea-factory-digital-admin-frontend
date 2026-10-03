/**
 * The signed-in frame: sidebar, topbar, notices, and the routed screen.
 *
 * The shell owns the dashboard query rather than the dashboard screen owning it,
 * because the sidebar's queue badges need the same numbers. One request, two
 * consumers — the alternative is the badge counts disagreeing with the screen
 * they link to, which is exactly the class of inconsistency AC-01 is about.
 */

import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { dashboardRepository } from '@/services/repositories/dashboardRepository';
import { qk } from '@/query/queryKeys';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { Notice, Spinner } from '@/components/ui/states';
import { formatDate, formatDateTime } from '@/lib/format';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useFactorySync } from './useFactorySync';

export function AppShell() {
  const { t } = useTranslation();
  const { degraded } = useRuntimeConfig();
  const sync = useFactorySync();

  const { data: summary } = useQuery({
    queryKey: qk.dashboard,
    queryFn: dashboardRepository.get,
    // The badges are a glance, not a live feed. A minute is fresh enough for a
    // queue and cheap enough on a shared connection.
    staleTime: 60_000,
    // A dashboard that cannot load must not take the console down: the sidebar
    // simply shows no counts.
    throwOnError: false,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar summary={summary} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        {/* Impossible to miss and impossible to dismiss. A console silently showing
            stale branding and flags is worse than a permanent banner.

            The mock banner that used to sit beside this one is gone with the mock
            itself — there is no longer a state in which this console serves fixtures,
            so there is nothing to warn about. */}
        {degraded ? <Notice tone="error">{t('shell.degradedConfig')}</Notice> : null}

        {/**
          * Every money figure in this console is replicated from the factory's own
          * system, so it is **as fresh as the last successful sync** — and the screens
          * say "read-only", which implies "and current".
          *
          * Across the whole shell rather than on the bills grid, because a clerk quotes
          * a balance from whichever screen happens to be open. `never` is separated from
          * `stale` because they need different people: one is a deployment that was
          * never finished, the other is a job that has stopped running.
          */}
        {sync.state === 'stale' ? (
          <Notice tone="warning">
            {t('shell.syncStale', {
              when: formatDateTime(sync.status?.lastSucceededAt),
              covers: formatDate(sync.status?.coversUpTo),
            })}
          </Notice>
        ) : sync.state === 'never' ? (
          <Notice tone="error">{t('shell.syncNever')}</Notice>
        ) : null}

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-sm focus:rounded-md focus:bg-surface focus:px-md focus:py-sm"
        >
          {t('shell.skipToContent')}
        </a>

        {/* 30 px from the sidebar on the left, 30 px from the window on the right
            (`--spacing-gutter`). The vertical padding stays on the shared scale —
            only the gutters are fixed geometry. */}
        <main id="main" className="min-w-0 flex-1 overflow-y-auto px-gutter py-lg">
          {/**
           * `h-full` is what lets a grid screen fill the window instead of
           * growing past it.
           *
           * It gives the wrapper a *definite* height, which a `flex-1` child can
           * then resolve against — without one, a screen asking for "the height
           * that is left" gets the height of its own content and the whole page
           * scrolls, header and pagination included.
           *
           * It does not squash the screens that are taller than the window
           * (dashboard, detail pages): their children keep `min-height: auto`, so
           * they refuse to shrink below their content and `main` scrolls as
           * before. Only a child that explicitly opts out with `min-h-0` — the
           * grid card — is asked to fit.
           */}
          {/**
           * `h-full` and **not** `min-h-full`, which was tried and reverted.
           *
           * The height has to be *definite* for a `flex-1` grid card to resolve against
           * it. Under `min-height: 100%` the container is auto-height, `flex-grow` has no
           * free space to distribute, and every grid sizes to its own content instead —
           * a fifty-row savings table rendered 2,582 px tall and scrolled the whole page
           * rather than itself. Measured, not reasoned about.
           *
           * The failure `min-h-full` was reaching for is real, though, and is fixed at the
           * other end: a definite height forces the flexible child to absorb any overflow,
           * and a card that opted out of `min-height: auto` absorbed it all the way to
           * zero. `GRID_CARD` gives that card a floor, so it overflows this wrapper and
           * `main` scrolls instead of the list disappearing.
           */}
          {/* Full width, deliberately: the 80 rem cap this used to carry would
              re-open the right-hand gap to whatever the monitor is wide, and a
              twelve-column grid is the screen that wants the pixels most. */}
          <div className="flex h-full flex-col gap-lg">
            {/* Module screens are lazy (see routes/router.tsx). The boundary is
                here rather than per route so the sidebar and topbar stay
                interactive while a screen's chunk arrives — a clerk can start
                navigating somewhere else instead of watching a blank page. */}
            <Suspense
              fallback={
                <div className="flex justify-center py-xxxl">
                  <Spinner />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
