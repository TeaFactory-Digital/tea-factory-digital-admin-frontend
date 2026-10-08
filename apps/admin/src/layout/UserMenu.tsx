/**
 * Who is signed in, and the way out.
 *
 * One component, two placements: a card at the foot of the sidebar on a desk-sized
 * window, and a compact trigger in the top bar where the sidebar is hidden. The menu
 * behind both is the same, so "where is sign out" has one answer per window size.
 *
 * The role is shown under the name on purpose. A clerk who has been handed a manager's
 * laptop needs to know which identity they are acting as before they approve something,
 * and "why is the approve button missing" is the second most common console support
 * question after "which month is open".
 */

import { useState } from 'react';
import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore, useCurrentUser } from '@/auth/authStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/cn';

/** `Nadeeka Perera` → `NP`. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/** The initials disc, in the factory's two brand colours. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-secondary text-caption font-semibold text-primary-contrast',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

const ITEM =
  'flex cursor-pointer items-center gap-sm rounded-sm px-sm py-xs text-body-small text-text-primary outline-none data-highlighted:bg-surface-variant';

export function UserMenu({ placement }: { placement: 'sidebar' | 'topbar' }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const logout = useAuthStore((s) => s.logout);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex min-w-0 items-center gap-sm rounded-md text-left transition-colors hover:bg-surface-variant',
              placement === 'sidebar' ? 'w-full p-xs' : 'p-xxs',
            )}
          >
            <Avatar name={user.name} />
            <span
              className={cn(
                'min-w-0 flex-1 flex-col',
                placement === 'sidebar' ? 'flex' : 'hidden sm:flex',
              )}
            >
              <span className="truncate text-body-small font-semibold text-text-primary">
                {user.name}
              </span>
              <span className="truncate text-caption text-text-secondary">
                {user.roles.join(', ')}
              </span>
            </span>
            <ChevronsUpDown className="size-icon-sm shrink-0 text-text-secondary" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={placement === 'sidebar' ? 'start' : 'end'}
          side={placement === 'sidebar' ? 'top' : 'bottom'}
          sideOffset={6}
          className="min-w-56 p-xs"
        >
          <div className="flex items-center gap-sm px-sm py-xs">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-body-small font-semibold text-text-primary">
                {user.name}
              </p>
              <p className="truncate text-caption text-text-secondary">{user.email}</p>
            </div>
          </div>
          <DropdownMenuSeparator className="my-xs h-px bg-divider" />

          <DropdownMenuItem asChild>
            <Link to="/profile" className={ITEM}>
              <UserRound className="size-icon-sm" aria-hidden />
              {t('profile.title')}
            </Link>
          </DropdownMenuItem>

          {/* Appearance and text size live on M15 alone: one home for a setting beats
              two, and the profile row above is the way to it. */}
          <DropdownMenuItem onSelect={() => setConfirmingSignOut(true)} className={ITEM}>
            <LogOut className="size-icon-sm" aria-hidden />
            {t('common.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title={t('common.signOut')}
        description={t('shell.signOutConfirmBody')}
        confirmLabel={t('common.signOut')}
        confirmVariant="danger"
        onConfirm={() => void logout()}
      />
    </>
  );
}
