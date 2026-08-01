/**
 * M15 Users & roles.
 *
 * **Two views, not two cards.** The user list and the §12.1 matrix are both primary and
 * neither fits beside the other — the matrix is fifteen capabilities across seven roles, and a
 * fill-height grid under it would be the short-screen bug again. So the view is in the URL and
 * only one is on screen at a time.
 *
 * The list's job is to answer one question before any other: **who can get us back in?** A
 * factory that suspends the wrong person has locked itself out of its own console, so the row
 * that is the last way in says so and withholds the control rather than offering one that
 * would be refused.
 *
 * There is no delete. A user who approved a payout or published a month is the actor on an
 * audit entry, and an entry whose actor cannot be resolved is not evidence — the same rule
 * that voids a delivery rather than removing it (§12.1).
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, Pencil, ShieldAlert, ShieldOff, UserPlus } from 'lucide-react';
import type { AdminConsoleUser, ConsoleRole, UserQuery } from '@tfd/domain';
import { useAuthStore, useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GRID_CARD } from '@/components/ui/layout';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/lib/useDebounced';
import { formatDateTime } from '@/lib/format';
import { RoleMatrixView } from './RoleMatrixView';
import { UserActionDialog, UserDialog } from './UserDialogs';
import { useUsers, type UserAction } from './hooks';

type View = 'users' | 'roles';

export function UsersScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const canEdit = useCan('usersAndRoles', 'write');
  const actingUserId = useAuthStore((s) => s.user?.id);

  const view: View = params.get('view') === 'roles' ? 'roles' : 'users';
  const status = params.get('status');
  const page = Number(params.get('page') ?? 0);

  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounced(searchText, 250);
  const [editing, setEditing] = useState<AdminConsoleUser | null>(null);
  const [inviting, setInviting] = useState(false);
  const [acting, setActing] = useState<{ user: AdminConsoleUser; action: UserAction } | null>(null);

  const query = useMemo<UserQuery>(
    () => ({
      q: debouncedSearch || undefined,
      status: (status as UserQuery['status']) ?? undefined,
      page,
      pageSize: 50,
    }),
    [debouncedSearch, status, page],
  );
  const users = useUsers(query);

  /** The whole set, which every lockout decision needs — not just the row being changed. */
  const all = useMemo(
    () =>
      (users.data?.items ?? []).map((one) => ({
        id: one.id,
        roles: one.roles,
        status: one.status,
      })),
    [users.data],
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const columns = useMemo<ColumnDef<AdminConsoleUser, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('users.column.person'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="font-medium text-text-primary">
                {row.name}
                {row.id === actingUserId ? (
                  <span className="ml-xs text-caption text-text-secondary">{t('users.you')}</span>
                ) : null}
              </span>
              <span className="text-caption text-text-secondary">{row.email}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'roles',
        header: t('users.column.roles'),
        enableSorting: false,
        cell: (info) => (
          <span className="flex flex-wrap gap-xxs">
            {info.getValue<ConsoleRole[]>().map((role) => (
              <Badge key={role} tone="neutral">
                {t(`users.role.${role}`)}
              </Badge>
            ))}
          </span>
        ),
      },
      {
        id: 'state',
        header: t('common.status'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex flex-col gap-xxs">
              <Badge tone={row.status === 'active' ? 'success' : 'error'}>
                {t(`users.status.${row.status}`)}
              </Badge>

              {/* The answer to "who can get us back in", on the row. A factory that
                  suspends this person has locked itself out. */}
              {row.isLastAdministrator ? (
                <Badge tone="warning">{t('users.lastAdministrator')}</Badge>
              ) : null}

              {/* MFA is mandatory for manager and above. Owed rather than enforced at the
                  point of granting — a user cannot enrol before they have an account. */}
              {row.owesMfa ? <Badge tone="error">{t('users.mfaOwed')}</Badge> : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'lastLoginAt',
        header: t('users.column.lastSignIn'),
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue<string | null>();
          return (
            <span className="numeric whitespace-nowrap text-text-secondary">
              {value ? formatDateTime(value) : t('users.neverSignedIn')}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('common.actions'),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!canEdit) return null;
          const isSelf = row.id === actingUserId;

          return (
            <span className="flex flex-wrap items-center gap-xs">
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Pencil className="size-icon-sm" aria-hidden />}
                onClick={() => setEditing(row)}
              >
                {t('users.edit')}
              </Button>

              {row.status === 'active' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  /**
                   * Withheld from yourself and from the last way in, rather than offered and
                   * refused. Both are `409`s the server raises anyway; the point of hiding
                   * them is that neither is ever something somebody meant to try.
                   */
                  disabled={isSelf || row.isLastAdministrator}
                  iconLeft={<ShieldOff className="size-icon-sm" aria-hidden />}
                  onClick={() => setActing({ user: row, action: 'suspend' })}
                >
                  {t('users.suspend')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={<ShieldAlert className="size-icon-sm" aria-hidden />}
                  onClick={() => setActing({ user: row, action: 'reactivate' })}
                >
                  {t('users.reactivate')}
                </Button>
              )}

              {row.mfaEnrolled ? (
                <Button
                  size="sm"
                  variant="ghost"
                  // Resetting your own is not recovery — it is dropping your second factor
                  // while holding a live session.
                  disabled={isSelf}
                  iconLeft={<KeyRound className="size-icon-sm" aria-hidden />}
                  onClick={() => setActing({ user: row, action: 'mfa' })}
                >
                  {t('users.resetMfa')}
                </Button>
              ) : null}
            </span>
          );
        },
      },
    ],
    [t, canEdit, actingUserId],
  );

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.subtitle')}
        actions={
          view === 'users' && canEdit ? (
            <Button
              variant="primary"
              iconLeft={<UserPlus className="size-icon-sm" aria-hidden />}
              onClick={() => setInviting(true)}
            >
              {t('users.invite')}
            </Button>
          ) : null
        }
      />

      {/* A real tab list: ← → move between the two views, and a screen reader announces which
          of two this is. */}
      <div role="tablist" aria-label={t('users.views')} className="flex shrink-0 flex-wrap gap-xs">
        {(['users', 'roles'] as View[]).map((one) => (
          <button
            key={one}
            type="button"
            role="tab"
            aria-selected={view === one}
            onClick={() => setParam('view', one === 'users' ? null : one)}
            className={cn(
              'rounded-md border px-md py-sm text-label',
              view === one
                ? 'border-primary bg-primary-muted font-semibold text-primary'
                : 'border-border bg-surface text-text-primary hover:bg-surface-variant',
            )}
          >
            {t(`users.view.${one}`)}
          </button>
        ))}
      </div>

      {view === 'roles' ? (
        <RoleMatrixView />
      ) : (
        <Card className={GRID_CARD}>
          <div className="flex shrink-0 flex-wrap items-end gap-sm border-b border-divider p-md">
            <SearchInput
              label={t('users.searchPlaceholder')}
              className="w-72"
              fullWidth={false}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            <label className="flex flex-col gap-xs text-label text-text-primary">
              {t('common.status')}
              <Select
                value={status ?? 'all'}
                onChange={(event) =>
                  setParam('status', event.target.value === 'all' ? null : event.target.value)
                }
                fullWidth={false}
              >
                <option value="all">{t('users.filter.all')}</option>
                <option value="active">{t('users.status.active')}</option>
                <option value="suspended">{t('users.status.suspended')}</option>
              </Select>
            </label>
          </div>

          <DataTable
            label={t('users.title')}
            columns={columns}
            page={users.data}
            loading={users.isPending}
            error={users.error}
            onRetry={() => void users.refetch()}
            getRowId={(row) => row.id}
            onPageChange={(next) => setParam('page', String(next))}
            emptyState={<EmptyState title={t('common.noResults')} body={t('common.noResultsHint')} />}
          />
        </Card>
      )}

      {/* No delete, stated once. An administrator who goes looking for it should find the
          reason rather than nothing. */}
      {view === 'users' ? (
        <p className="text-caption text-text-secondary">{t('users.noDeleteHint')}</p>
      ) : null}

      <UserDialog
        open={inviting || editing !== null}
        user={editing}
        users={all}
        onClose={() => {
          setInviting(false);
          setEditing(null);
        }}
      />

      <UserActionDialog
        user={acting?.user ?? null}
        action={acting?.action ?? 'suspend'}
        users={all}
        onClose={() => setActing(null)}
      />
    </>
  );
}
