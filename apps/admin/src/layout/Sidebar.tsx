/**
 * The console's primary navigation.
 *
 * Persistent rather than collapsible: a clerk moves between the queue and a
 * supplier record dozens of times an hour, and a nav that has to be opened first
 * costs a click every time. It hides below `lg` because the office occasionally
 * checks something on a tablet, and there the topbar carries a menu instead.
 */

import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { can } from '@tfd/domain';
import type { DashboardView } from '@/services/repositories/dashboardRepository';
import { useAuthStore } from '@/auth/authStore';
import { useFeatureFlags } from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { CountBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { NAVIGATION, flagsOf, queuesOf, type NavItem } from './navigation';

export function Sidebar({ summary }: { summary?: DashboardView }) {
  const { t } = useTranslation();
  const grants = useAuthStore((s) => s.grants);
  const flags = useFeatureFlags();

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
    items: section.items.filter((item) => {
      // Flag first: a feature the factory does not buy is not a permission
      // question, and asking it in the other order shows a manure queue to a
      // manager at a factory that has never sold fertilizer.
      const needed = flagsOf(item);
      const enabled = needed.length === 0 || needed.some((flag) => flags[flag]);
      return enabled && can(grants, item.capability, 'read');
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <nav
      aria-label={t('nav.dashboard')}
      className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex"
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
       * the active styling when the dashboard is open — two things would then look
       * selected at once.
       */}
      {/* `h-14`, the topbar's height, so the two bottom borders meet in one line. */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-sm">
        <Link
          to="/"
          aria-label={t('nav.dashboard')}
          className="flex w-full items-center rounded-md px-sm py-xs transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Logo />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-sm py-md">
        {sections.map((section, index) => (
          <div
            key={section.titleKey}
            className={cn(index > 0 && 'mt-md border-t border-divider pt-md')}
          >
            <h2 className="px-sm pb-xs text-overline tracking-wider text-text-secondary uppercase">
              {t(section.titleKey)}
            </h2>
            <ul className="flex flex-col gap-xxs">
              {section.items.map((item) => (
                <li key={item.module}>
                  <SidebarLink item={item} pending={pendingFor(item)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/**
 * One row: a rounded pill with the icon in its own small tile.
 *
 * The open screen is a solid pill in the factory's primary colour rather than a tinted
 * row with an edge line, so "where am I" is answered at a glance from across the desk.
 * Every colour is a brand token: the console is white-labelled, and a hard-coded green
 * would be wrong for every factory whose brand is not green.
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
          'group flex items-center gap-sm rounded-md px-xs py-xs text-body-small transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-primary font-semibold text-primary-contrast shadow-sm'
            : 'text-text-primary hover:bg-surface-variant',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
              isActive
                ? 'bg-primary-contrast/15 text-primary-contrast'
                : 'bg-surface-variant text-text-secondary group-hover:bg-primary-muted group-hover:text-primary',
            )}
          >
            <Icon className="size-icon-sm" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
          <CountBadge count={pending} />
        </>
      )}
    </NavLink>
  );
}
