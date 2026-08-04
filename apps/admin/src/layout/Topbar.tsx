/**
 * The top bar: who is signed in, which factory, and the way out.
 *
 * The role is shown next to the name on purpose. A clerk who has been handed a
 * manager's laptop needs to know which identity they are acting as before they
 * approve something, and "why is the approve button missing" is the second most
 * common console support question after "which month is open".
 */

import { useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useCurrentUser } from '@/auth/authStore';
import { useFactory } from '@/config/RuntimeConfigProvider';
import { allowTenantOverride, tenantId, tenantSource, switchTenantByReload } from '@/config/tenant';
import { MOCK_TENANT_IDS } from '@/services/mocks/seed';
import { Logo } from '@/brand/Logo';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Select } from '@/components/ui/Select';

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
        {/* Always visible, and to the left of the account menu on purpose: a clerk
            who cannot read the current language needs to reach this without opening
            a menu whose trigger they cannot read either. */}
        <LanguageSwitcher />

        {/* Tenant switcher, in development and the hosted demo only (see
            config/tenant.ts). Reloads rather than mutating state: a tenant change
            invalidates every cached query and the applied theme, and in production
            it is a different subdomain and a fresh document anyway. */}
        {allowTenantOverride ? (
          <label className="hidden items-center gap-xs text-caption text-text-secondary md:flex">
            {t('shell.tenantSwitcher')}
            <Select
              value={tenantId}
              onChange={(event) => switchTenantByReload(event.target.value)}
              className="h-9 min-w-24 px-sm text-caption"
              fullWidth={false}
            >
              {[...new Set([tenantId, ...MOCK_TENANT_IDS])].map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
            {tenantSource === 'fallback' ? <Badge tone="warning">fallback</Badge> : null}
          </label>
        ) : null}

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
