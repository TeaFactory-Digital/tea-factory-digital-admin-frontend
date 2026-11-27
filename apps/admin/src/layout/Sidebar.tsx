/**
 * The console's primary navigation.
 *
 * Persistent, never hidden behind a menu: a clerk moves between the queue and a
 * supplier record dozens of times an hour, and a nav that has to be opened first
 * costs a click every time. Since 23 November 2026 it can narrow to a rail of icons
 * (a person's own choice, the [ key), which keeps every link one click away. It hides below `lg` because the office occasionally
 * checks something on a tablet, and there the topbar carries a menu instead.
 *
 * Top to bottom: whose console this is, the modules, the app-adoption meter, and
 * who is signed in. It sits on the page canvas rather than on a white panel, so the
 * cards on the right are the only raised surfaces on screen.
 */

import { useEffect, type MouseEvent } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { can } from '@tfd/domain';
import type { DashboardView } from '@/services/repositories/dashboardRepository';
import { useAuthStore } from '@/auth/authStore';
import {
  useFactory,
  useFeatureFlags,
  useKeepsFactoryRecords,
} from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { CountBadge } from '@/components/ui/Badge';
import { Meter } from '@/components/charts/Meter';
import { formatCount, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { NAVIGATION, isNavItemVisible, queuesOf, type NavItem } from './navigation';
import { UserMenu } from './UserMenu';
import { InfoTip } from '@/components/ui/Tooltip';
import { useAppearance } from '@/brand/useAppearance';
import { motionAllowed } from '@/lib/motion';
import { InlineLink } from '@/components/ui/InlineLink';
import { useSlidingTile } from '@/lib/useSlidingTile';
import { playSound } from '@/lib/sound/uiSound';

export function Sidebar({ summary }: { summary?: DashboardView }) {
  const { t } = useTranslation();
  const grants = useAuthStore((s) => s.grants);
  const flags = useFeatureFlags();
  const keepsRecords = useKeepsFactoryRecords();
  const factory = useFactory();

  /**
   * Summed across the row's queues.
   *
   * The credit row opens three of them behind one link, and a badge counting only
   * the advances would tell a clerk the inbox is emptier than it is. Queues the
   * tenant has switched off are simply absent from the payload, so they contribute
   * nothing without needing to be filtered here.
   */
  const pendingFor = (item: NavItem) =>
    queuesOf(item).reduce(
      (total, key) => total + (summary?.queues.find((q) => q.queue === key)?.pending ?? 0),
      0,
    );

  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      isNavItemVisible(item, flags, (c) => can(grants, c, 'read'), keepsRecords),
    ),
  })).filter((section) => section.items.length > 0);

  const canSeeAdoption = can(grants, 'reports', 'read');

  /** Which rows are drawn, so the open-row tile looks again when they change. */
  const rowsKey = sections.flatMap((section) => section.items.map((item) => item.to)).join(',');

  /**
   * The rail (23 November 2026): icons only, so a grid gets the width on a 1366 laptop. A
   * person's own choice, kept with the rest of their appearance; the menu under their name
   * or the [ key switches it.
   */
  const { appearance, setSidebar } = useAppearance();
  const rail = appearance.sidebar === 'icons';
  const { pathname } = useLocation();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '[' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      setSidebar(rail ? 'full' : 'icons');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rail, setSidebar]);

  return (
    <nav
      aria-label={t('nav.dashboard')}
      data-glass-surface="sidebar"
      data-sidebar={rail ? 'icons' : 'full'}
      className={cn(
        'hidden shrink-0 flex-col gap-md border-r border-border bg-background py-lg transition-[width] duration-200 lg:flex',
        rail ? 'w-20 items-stretch px-sm' : 'w-64 px-md',
      )}
    >
      {/**
       * The mark is the way home.
       *
       * A convention every console has, and its absence is only noticed as a small
       * repeated friction: from a supplier's detail screen the way back to the dashboard
       * was to find *Dashboard* in the list below, even though the obvious target was
       * already at the top of the sidebar and being clicked.
       *
       * A plain `Link` rather than a `NavLink`: this is not a nav row and must not take
       * the active styling when the dashboard is open: two things would then look
       * selected at once.
       */}
      <Link
        to="/"
        title={rail ? factory.name : undefined}
        onClick={(event) => {
          if (pathname !== '/' && !opensElsewhere(event)) playSound('tick');
        }}
        className={cn(
          'flex shrink-0 items-center gap-sm rounded-md p-xs transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          rail && 'justify-center',
        )}
      >
        <Logo showName={false} />
        <span className={cn('flex min-w-0 flex-col', rail && 'sr-only')}>
          <span className="truncate text-body-small font-bold tracking-tight text-text-primary">
            {factory.name}
          </span>
          <span className="truncate text-caption text-text-secondary">
            {factory.location || t('shell.consoleName')}
          </span>
          {/* Where it goes, after the words it shows: a spoken name has to start with the
              visible one (WCAG 2.5.3), so voice control can say what it sees. */}
          <span className="sr-only">{t('nav.dashboard')}</span>
        </span>
      </Link>

      <div data-nav-rows className="relative -mx-xs min-h-0 flex-1 overflow-y-auto px-xs">
        <ActiveTile watch={`${pathname} ${rail} ${rowsKey}`} />
        {sections.map((section, index) => (
          <div
            key={section.titleKey}
            className={cn(index > 0 && (rail ? 'mt-sm border-t border-divider pt-sm' : 'mt-lg'))}
          >
            <h2
              className={cn(
                'px-sm pb-xs text-caption font-medium text-text-secondary',
                rail && 'sr-only',
              )}
            >
              {t(section.titleKey)}
            </h2>
            <ul className="flex flex-col gap-xxs">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} pending={pendingFor(item)} rail={rail} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {canSeeAdoption && summary && !rail ? <AdoptionMeter app={summary.app} /> : null}

      <UserMenu placement={rail ? 'rail' : 'sidebar'} />
    </nav>
  );
}

/**
 * How much of the supplier base is on the app, as a meter at the foot of the nav.
 *
 * The one figure this console is answerable for (§19.3), kept in view on every screen
 * rather than only on the dashboard. It reads the summary the shell already fetched for
 * the badges, so it costs no request of its own.
 */
function AdoptionMeter({ app }: { app: DashboardView['app'] }) {
  const { t } = useTranslation();
  if (app.totalSuppliers <= 0) return null;

  const share = app.suppliersWithApp / app.totalSuppliers;

  return (
    <div className="flex shrink-0 flex-col gap-sm rounded-lg border border-border bg-surface p-md shadow-card">
      <div className="flex items-center justify-between gap-sm text-label">
        {/* The count behind the share sits behind the "i" (24 November 2026). */}
        <span className="flex items-center gap-xxs font-semibold text-text-primary">
          {t('dashboard.appAdoption')}
          <InfoTip label={`${t('tip.moreInfo')}: ${t('dashboard.appAdoption')}`} side="right">
            {t('dashboard.appInstalled', {
              withApp: formatCount(app.suppliersWithApp),
              total: formatCount(app.totalSuppliers),
            })}
          </InfoTip>
        </span>
        {/* The suppliers still to bring onto the app (27 November 2026). */}
        <InlineLink
          to="/suppliers?hasApp=false"
          arrow={false}
          className="numeric font-normal text-text-secondary hover:text-primary"
        >
          <span title={t('link.withoutApp')}>{formatPercent(share)}</span>
        </InlineLink>
      </div>
      <Meter value={share} label={t('dashboard.appAdoption')} />
    </div>
  );
}

/** A click that opens a new tab or window leaves this screen where it is: no sound for it. */
function opensElsewhere(event: MouseEvent): boolean {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0;
}

/**
 * The white key behind the open screen's row (26 November 2026), as one tile that slides
 * from the row that was open to the row that is, so the eye follows the move instead of
 * finding the new row again.
 *
 * Measured from the row React Router marks `aria-current="page"` (`useSlidingTile`), looked
 * for again when the rows are redrawn (`watch`). None on a screen with no row of its own.
 *
 * Two ways it moves, because a sidebar click is a View Transition and the live page is
 * hidden behind the browser's snapshots while one runs: there, the tile and the rows are
 * named in `theme.css` and the browser slides the tile under the labels; anywhere else it is
 * the hook's CSS transition. Both last `MOTION_MS.base`, so they finish together, and the
 * Animations switch and reduced motion stop both.
 */
function ActiveTile({ watch }: { watch: string }) {
  const tile = useSlidingTile<HTMLSpanElement>('[data-nav-link][aria-current="page"]', watch);
  return (
    <span
      ref={tile.ref}
      aria-hidden
      data-nav-tile={tile.shown ? '' : undefined}
      hidden={!tile.shown}
      className={cn(
        'pointer-events-none absolute top-0 left-0 rounded-md bg-surface shadow-card ring-1 ring-border',
        tile.motion,
      )}
      style={tile.style}
    />
  );
}

/**
 * One row: icon and label on the canvas, muted until it is the open screen.
 *
 * The open screen lifts onto a white key with a hairline edge (`ActiveTile`, drawn behind
 * the rows so it can slide between them) and its icon takes the factory's primary colour, so "where am I" is answered at a glance without a block of
 * saturated colour competing with the page. Every colour is a brand token: the console is
 * white-labelled, and a hard-coded green would be wrong for every factory whose brand is
 * not green.
 */
function SidebarLink({ item, pending, rail }: { item: NavItem; pending: number; rail: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      viewTransition={motionAllowed()}
      data-nav-link
      onClick={(event) => {
        // A click on the row already open goes nowhere, so it makes no sound.
        if (event.currentTarget.getAttribute('aria-current') !== 'page' && !opensElsewhere(event)) {
          playSound('tick');
        }
      }}
      // On the rail the label is not on screen: the tooltip shows it, and it stays the name.
      title={rail ? t(item.labelKey) : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-sm rounded-md px-sm text-body-small font-medium transition-colors duration-150',
          rail && 'justify-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'text-text-primary'
            : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'size-icon-sm shrink-0 transition-colors duration-150',
              isActive ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary',
            )}
            aria-hidden
          />
          {/* Wraps rather than cuts: a Tamil or Sinhala label can be longer than the English. */}
          <span className={cn('min-w-0 flex-1 break-words leading-tight', rail && 'sr-only')}>
            {t(item.labelKey)}
          </span>
          {rail ? (
            pending > 0 ? (
              <span className="absolute -top-xxs -right-xxs">
                <CountBadge count={pending} />
              </span>
            ) : null
          ) : (
            <CountBadge count={pending} />
          )}
        </>
      )}
    </NavLink>
  );
}
