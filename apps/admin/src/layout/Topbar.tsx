/**
 * The top bar: who is signed in, which factory, and the way out.
 *
 * The role is shown next to the name on purpose. A clerk who has been handed a
 * manager's laptop needs to know which identity they are acting as before they
 * approve something, and "why is the approve button missing" is the second most
 * common console support question after "which month is open".
 */

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useCurrentUser } from '@/auth/authStore';
import { useFactory } from '@/config/RuntimeConfigProvider';
import { env } from '@/config/env';
import { tenantId, tenantSource, switchTenantForDevelopment } from '@/config/tenant';
import { MOCK_TENANT_IDS } from '@/services/mocks/seed';
import { Logo } from '@/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export function Topbar() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const factory = useFactory();
  const logout = useAuthStore((s) => s.logout);

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
        {/* Dev-only tenant switcher. Reloads rather than mutating state: a tenant
            change invalidates every cached query and the applied theme, and in
            production it is a different subdomain and a fresh document anyway. */}
        {env.isDev ? (
          <label className="hidden items-center gap-xs text-caption text-text-secondary md:flex">
            {t('shell.devTenant')}
            <select
              value={tenantId}
              onChange={(event) => switchTenantForDevelopment(event.target.value)}
              className="h-9 rounded-md border border-border bg-surface px-sm text-caption text-text-primary"
            >
              {[...new Set([tenantId, ...MOCK_TENANT_IDS])].map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            {tenantSource === 'fallback' ? <Badge tone="warning">fallback</Badge> : null}
          </label>
        ) : null}

        {user ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" iconRight={<ChevronDown className="size-icon-sm" />}>
                <span className="flex flex-col items-start">
                  <span className="text-label">{user.name}</span>
                  <span className="text-caption text-text-secondary">
                    {user.roles.join(', ')}
                  </span>
                </span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-56 rounded-md border border-border bg-surface p-xs shadow-lg"
              >
                <div className="px-sm py-xs">
                  <p className="text-body-small text-text-primary">{user.name}</p>
                  <p className="text-caption text-text-secondary">{user.email}</p>
                </div>
                <DropdownMenu.Separator className="my-xs h-px bg-divider" />
                <DropdownMenu.Item
                  onSelect={() => void logout()}
                  className="flex cursor-pointer items-center gap-sm rounded-sm px-sm py-xs text-body-small text-text-primary outline-none data-highlighted:bg-surface-variant"
                >
                  <LogOut className="size-icon-sm" aria-hidden />
                  {t('common.signOut')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : null}
      </div>
    </header>
  );
}
