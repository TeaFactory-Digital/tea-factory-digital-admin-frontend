/**
 * The console's primary navigation.
 *
 * Persistent rather than collapsible: a clerk moves between the queue and a
 * supplier record dozens of times an hour, and a nav that has to be opened first
 * costs a click every time. It hides below `lg` because the office occasionally
 * checks something on a tablet, and there the topbar carries a menu instead.
 *
 * Top to bottom: whose console this is, the modules, the app-adoption meter, and
 * who is signed in. It sits on the page canvas rather than on a white panel, so the
 * cards on the right are the only raised surfaces on screen.
 */

import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { can } from '@tfd/domain';
import type { DashboardView } from '@/services/repositories/dashboardRepository';
import { useAuthStore } from '@/auth/authStore';
import { useFactory, useFeatureFlags, useKeepsFactoryRecords } from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { CountBadge } from '@/components/ui/Badge';
import { Meter } from '@/components/charts/Meter';
import { formatCount, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { NAVIGATION, isNavItemVisible, queuesOf, type NavItem } from './navigation';
import { UserMenu } from './UserMenu';

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

  return (
    <nav
      aria-label={t('nav.dashboard')}
      className="hidden w-64 shrink-0 flex-col gap-md border-r border-border bg-background px-md py-lg lg:flex"
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
        aria-label={t('nav.dashboard')}
        className="flex shrink-0 items-center gap-sm rounded-md p-xs transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Logo showName={false} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-small font-bold tracking-tight text-text-primary">
            {factory.name}
          </span>
          <span className="truncate text-caption text-text-secondary">
            {factory.location || t('shell.consoleName')}
          </span>
        </span>
      </Link>

      <div className="-mx-xs min-h-0 flex-1 overflow-y-auto px-xs">
        {sections.map((section, index) => (
          <div key={section.titleKey} className={cn(index > 0 && 'mt-lg')}>
            <h2 className="px-sm pb-xs text-caption font-medium text-text-secondary">
              {t(section.titleKey)}
            </h2>
            <ul className="flex flex-col gap-xxs">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} pending={pendingFor(item)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {canSeeAdoption && summary ? <AdoptionMeter app={summary.app} /> : null}

      <UserMenu placement="sidebar" />
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
      <div className="flex items-baseline justify-between gap-sm text-label">
        <span className="font-semibold text-text-primary">{t('dashboard.appAdoption')}</span>
        <span className="numeric text-text-secondary">{formatPercent(share)}</span>
      </div>
      <Meter value={share} label={t('dashboard.appAdoption')} />
      <span className="numeric text-caption text-text-secondary">
        {t('dashboard.appInstalled', {
          withApp: formatCount(app.suppliersWithApp),
          total: formatCount(app.totalSuppliers),
        })}
      </span>
    </div>
  );
}

/**
 * One row: icon and label on the canvas, muted until it is the open screen.
 *
 * The open screen lifts onto a white key with a hairline edge and its icon takes the
 * factory's primary colour, so "where am I" is answered at a glance without a block of
 * saturated colour competing with the page. Every colour is a brand token: the console is
 * white-labelled, and a hard-coded green would be wrong for every factory whose brand is
 * not green.
 */
function SidebarLink({ item, pending }: { item: NavItem; pending: number }) {
  const { t } = useTranslation();
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group flex h-9 items-center gap-sm rounded-md px-sm text-body-small font-medium transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-surface text-text-primary shadow-card ring-1 ring-border'
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
          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
          <CountBadge count={pending} />
        </>
      )}
    </NavLink>
  );
}
