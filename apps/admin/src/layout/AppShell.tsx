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
import { env } from '@/config/env';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { Notice, Spinner } from '@/components/ui/states';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const { t } = useTranslation();
  const { degraded } = useRuntimeConfig();

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

        {/* Both notices are deliberately impossible to miss and impossible to
            dismiss. A console silently serving fixtures, or silently showing
            stale branding and flags, is worse than a permanent banner. */}
        {env.useMock ? <Notice tone="warning">{t('shell.mockBanner')}</Notice> : null}
        {degraded ? <Notice tone="error">{t('shell.degradedConfig')}</Notice> : null}

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-sm focus:rounded-md focus:bg-surface focus:px-md focus:py-sm"
        >
          {t('shell.skipToContent')}
        </a>

        <main id="main" className="min-w-0 flex-1 overflow-y-auto p-lg">
          <div className="mx-auto flex max-w-page flex-col gap-lg">
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
