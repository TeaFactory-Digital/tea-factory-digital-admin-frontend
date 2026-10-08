/**
 * The top bar: where you are, search, and whether the figures are current.
 *
 * It sits on the canvas with no rule under it, so the page title below reads as the
 * start of the page rather than as the second bar in a stack. The left side is a
 * breadcrumb, *factory · module*, because a platform administrator moving between
 * tenants needs the factory name in view on every screen.
 *
 * Who is signed in lives at the foot of the sidebar on a desk-sized window. Below `lg`
 * the sidebar is hidden, so the same menu appears here instead.
 */

import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useFactory } from '@/config/RuntimeConfigProvider';
import { Logo } from '@/brand/Logo';
import { SyncStatusChip } from './SyncStatusChip';
import { CommandMenu } from './CommandMenu';
import { NAVIGATION } from './navigation';
import { UserMenu } from './UserMenu';

/**
 * The nav row that owns a path, by the longest matching prefix.
 *
 * `/suppliers/S-0042` belongs to `/suppliers`, and `/` only matches itself — otherwise
 * every screen would claim to be the dashboard.
 */
function sectionLabelKey(pathname: string): string | null {
  const items = NAVIGATION.flatMap((section) => section.items);
  const match = items
    .filter((item) =>
      item.to === '/'
        ? pathname === '/'
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
    )
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.labelKey ?? null;
}

export function Topbar() {
  const { t } = useTranslation();
  const factory = useFactory();
  const { pathname } = useLocation();
  const labelKey = sectionLabelKey(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-md px-gutter">
      <div className="flex min-w-0 items-center gap-md">
        <span className="lg:hidden">
          <Logo showName={false} />
        </span>
        <p className="flex min-w-0 items-center gap-xs text-label text-text-secondary">
          <span className="truncate">{factory.name}</span>
          {labelKey ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate text-text-primary">{t(labelKey)}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex items-center gap-sm">
        <SyncStatusChip />
        <CommandMenu />
        <span className="lg:hidden">
          <UserMenu placement="topbar" />
        </span>
      </div>
    </header>
  );
}
