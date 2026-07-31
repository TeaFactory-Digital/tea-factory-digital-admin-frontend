/**
 * The console's primary navigation.
 *
 * Persistent rather than collapsible: a clerk moves between the queue and a
 * supplier record dozens of times an hour, and a nav that has to be opened first
 * costs a click every time. It hides below `lg` because the office occasionally
 * checks something on a tablet, and there the topbar carries a menu instead.
 */

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DashboardSummary } from '@tfd/domain';
import { can } from '@tfd/domain';
import { useAuthStore } from '@/auth/authStore';
import { useFeatureFlags } from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { Badge, CountBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { NAVIGATION, type NavItem } from './navigation';

export function Sidebar({ summary }: { summary?: DashboardSummary }) {
  const { t } = useTranslation();
  const grants = useAuthStore((s) => s.grants);
  const flags = useFeatureFlags();

  const pendingFor = (item: NavItem) =>
    item.queue ? (summary?.queues.find((q) => q.queue === item.queue)?.pending ?? 0) : 0;

  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        // Flag first: a feature the factory does not buy is not a permission
        // question, and asking it in the other order shows a manure queue to a
        // manager at a factory that has never sold fertilizer.
        (!item.flag || flags[item.flag]) && can(grants, item.capability, 'read'),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <nav
      aria-label={t('nav.dashboard')}
      className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex"
    >
      <div className="border-b border-border px-lg py-md">
        <Logo />
      </div>

      <div className="flex-1 overflow-y-auto py-sm">
        {sections.map((section) => (
          <div key={section.titleKey} className="mb-md">
            <h2 className="px-lg py-xs text-overline text-text-secondary uppercase">
              {t(section.titleKey)}
            </h2>
            <ul>
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

function SidebarLink({ item, pending }: { item: NavItem; pending: number }) {
  const { t } = useTranslation();
  const Icon = item.icon;

  // A planned module is shown and disabled, not linked. Navigating to a route
  // that renders "coming soon" is a worse answer than a row that says so.
  if (item.status === 'planned') {
    return (
      <span
        aria-disabled
        title={t('common.plannedHint')}
        className="flex cursor-not-allowed items-center gap-sm px-lg py-sm text-body-small text-disabled-contrast"
      >
        <Icon className="size-icon-md shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
        <Badge tone="neutral">{t('common.planned')}</Badge>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-sm border-l-2 px-lg py-sm text-body-small',
          isActive
            ? 'border-primary bg-primary-muted font-semibold text-primary'
            : 'border-transparent text-text-primary hover:bg-surface-variant',
        )
      }
    >
      <Icon className="size-icon-md shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
      <CountBadge count={pending} />
    </NavLink>
  );
}
