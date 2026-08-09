/**
 * The top bar: who is signed in, which factory, and the way out.
 *
 * The role is shown next to the name on purpose. A clerk who has been handed a
 * manager's laptop needs to know which identity they are acting as before they
 * approve something, and "why is the approve button missing" is the second most
 * common console support question after "which month is open".
 */

import { useState } from 'react';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore, useCurrentUser } from '@/auth/authStore';
import { useFactory } from '@/config/RuntimeConfigProvider';
/* Hidden with the tenant switcher below — `Badge`, `Select` and all four tenant values
   were used by it and by nothing else here:

   import { allowTenantOverride, tenantId, tenantSource, switchTenantByReload } from '@/config/tenant';
   import { MOCK_TENANT_IDS } from '@/services/mocks/seed';
   import { Badge } from '@/components/ui/Badge';
   import { Select } from '@/components/ui/Select';
*/
import { Logo } from '@/brand/Logo';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

export function Topbar() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const factory = useFactory();
  const logout = useAuthStore((s) => s.logout);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  async function submitLogout() {
    await logout();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-md border-b border-border bg-surface px-lg">
      <div className="flex min-w-0 items-center gap-md">
        <span className="lg:hidden">
          <Logo showName={false} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-body-small font-semibold text-text-primary">{factory.name}</p>
          {factory.location ? (
            <p className="truncate text-caption text-text-secondary">{factory.location}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-md">

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                iconRight={<ChevronDown className="size-icon-sm" />}
              >
                <span className="flex flex-col items-start">
                  <span className="text-label">{user.name}</span>
                  <span className="text-caption text-text-secondary">{user.roles.join(', ')}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-56 p-xs">
              <div className="px-sm py-xs">
                <p className="text-body-small text-text-primary">{user.name}</p>
                <p className="text-caption text-text-secondary">{user.email}</p>
              </div>
              <DropdownMenuSeparator className="my-xs h-px bg-divider" />

              <DropdownMenuItem asChild>
                <Link
                  to="/profile"
                  className="flex cursor-pointer items-center gap-sm rounded-sm px-sm py-xs text-body-small text-text-primary outline-none data-highlighted:bg-surface-variant"
                >
                  <UserRound className="size-icon-sm" aria-hidden />
                  {t('profile.title')}
                </Link>
              </DropdownMenuItem>

              {/* Appearance and text size were here too, as a non-item block Radix keeps
                  the menu open for. They live on M15 alone now: one home for a setting
                  beats two, and the profile row above is the way to it.

                    <AppearanceControls className="px-sm py-xs" />
              */}
              <DropdownMenuItem
                onSelect={() => setConfirmingSignOut(true)}
                className="flex cursor-pointer items-center gap-sm rounded-sm px-sm py-xs text-body-small text-text-primary outline-none data-highlighted:bg-surface-variant"
              >
                <LogOut className="size-icon-sm" aria-hidden />
                {t('common.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title={t('common.signOut')}
        description={t('shell.signOutConfirmBody')}
        confirmLabel={t('common.signOut')}
        confirmVariant="danger"
        onConfirm={() => void submitLogout()}
      />
    </header>
  );
}
