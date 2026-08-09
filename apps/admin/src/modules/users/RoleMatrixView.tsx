/**
 * The §12.1 matrix, editable.
 *
 * **This view is rbac.md's central promise made true.** That document says the table is
 * *"data, not code: a factory will want to split or merge these roles, and that must not be a
 * deploy"* — and until this screen existed, `packages/domain/src/rbac.ts` was the authority
 * while claiming to be a default. Now it is the default it always said it was.
 *
 * Rendered as the matrix rather than as five role forms, because the question an
 * administrator arrives with is comparative: *"who else can approve a credit request?"* is
 * one column read down, and five separate forms make it five screens.
 *
 * **Twelve rows, not fifteen.** `deliveries`, `ratesAndMonthClose` and `payouts` are the
 * factory's own console's, and this build routes nothing behind them — rendered, they are
 * three dropdowns an administrator can set to `approve`, get a success toast for, and
 * change nothing whatsoever by. `FACTORY_CONSOLE_CAPABILITIES` names them, and their
 * stored levels are **preserved rather than dropped**: `change()` spreads the whole
 * `matrix[role]`, so a hidden grant survives an edit to a visible one untouched. Hiding a
 * value the console still sends back is only safe because of that spread — read it before
 * changing how a row saves.
 *
 * The refusal is the lockout nobody thinks of. Every user can keep their roles while the roles
 * stop granting `usersAndRoles`, and the factory is locked out without a single user record
 * changing — so the guard is on the **proposed matrix**, not on any user. It runs against the
 * whole matrix, hidden rows included, because `usersAndRoles` is visible and a guard that
 * only saw what was on screen would be a guard with a blind spot.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, TriangleAlert } from 'lucide-react';
import {
  DEFAULT_ROLE_MATRIX,
  RECOVERY_CAPABILITY,
  isRoutedCapability,
  matrixKeepsRecovery,
  type AccessLevel,
  type Capability,
  type ConsoleRole,
  type RoleMatrix,
} from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useRoleMatrix, useSetRoleGrants } from './hooks';

const ROLES = Object.keys(DEFAULT_ROLE_MATRIX) as ConsoleRole[];
/** The matrix minus the factory's own console's rows — see the note above. */
const CAPABILITIES = (Object.keys(DEFAULT_ROLE_MATRIX.clerk) as Capability[]).filter(
  isRoutedCapability,
);
const LEVELS: AccessLevel[] = ['none', 'read', 'write', 'approve'];

export function RoleMatrixView() {
  const { t } = useTranslation();
  const toast = useToast();
  const canEdit = useCan('usersAndRoles', 'write');

  const query = useRoleMatrix();
  const setGrants = useSetRoleGrants();
  const [pending, setPending] = useState<{ role: ConsoleRole; capability: Capability } | null>(null);

  if (query.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (query.error || !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const { matrix, customised, updatedAt, updatedByName }: RoleMatrix = query.data;

  async function change(role: ConsoleRole, capability: Capability, level: AccessLevel) {
    const grants = { ...matrix[role], [capability]: level };
    const proposed = { ...matrix, [role]: grants };

    /**
     * Checked here as well as in the repository and on the server, because this is the one
     * control in the console that can make the console unreachable. Three layers is not
     * belt-and-braces — the toast has to be able to explain it before the request goes.
     */
    if (!matrixKeepsRecovery(proposed)) {
      toast.error(t('users.matrixLockoutTitle'), t('users.matrixLockoutBody'));
      return;
    }

    setPending({ role, capability });
    try {
      await setGrants.mutateAsync({ role, grants, currentMatrix: matrix });
      toast.success(t('users.roleSaved', { role: t(`users.role.${role}`) }));
    } catch (cause) {
      toast.error(t('users.roleSaveFailed'), t(errorMessageKey(cause)));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader
        title={t('users.matrixTitle')}
        description={t('users.matrixDescription')}
        className="shrink-0"
        actions={
          <div className="flex flex-wrap items-center gap-sm">
            {/* Whether this factory has diverged from the shipped table. Without it a reader
                has to compare fifteen rows against a document to find out. */}
            <Badge tone={customised ? 'info' : 'neutral'}>
              {customised ? t('users.matrixCustomised') : t('users.matrixDefault')}
            </Badge>
            {updatedAt ? (
              <span className="text-caption text-text-secondary">
                {t('users.matrixChanged', {
                  name: updatedByName ?? '—',
                  when: formatDateTime(updatedAt),
                })}
              </span>
            ) : null}
          </div>
        }
      />

      {/* The only scrolling region, in both axes. Five role columns fit a laptop where seven
          did not, but the axes stay: a factory that splits a role adds a column, and the
          capability name has to stay readable while scrolling right when it does. */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-data-cell" aria-label={t('users.matrixTitle')}>
          <thead className="sticky top-0 z-10 bg-table-header shadow-[inset_0_-1px_0_0_var(--color-border)]">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-table-header px-md py-sm text-left text-data-header uppercase text-text-secondary"
              >
                {t('users.capability')}
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-md py-sm text-left text-data-header whitespace-nowrap uppercase text-text-secondary"
                >
                  {t(`users.role.${role}`)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {CAPABILITIES.map((capability, index) => {
              const isRecovery = capability === RECOVERY_CAPABILITY;
              return (
                <tr
                  key={capability}
                  className={cn(index % 2 === 1 && 'bg-table-row-alt', 'border-b border-divider')}
                >
                  <th
                    scope="row"
                    className={
                      // The recovery row is marked, because it is the one whose column of
                      // dashes locks the factory out of its own console.
                      index % 2 === 1
                        ? 'sticky left-0 bg-table-row-alt px-md py-sm text-left font-medium text-text-primary'
                        : 'sticky left-0 bg-surface px-md py-sm text-left font-medium text-text-primary'
                    }
                  >
                    <span className="flex items-center gap-xs whitespace-nowrap">
                      {t(`users.capabilityName.${capability}`)}
                      {isRecovery ? (
                        <span title={t('users.recoveryCapabilityHint')} className="text-primary">
                          <KeyRound className="size-icon-xs" aria-hidden />
                          <span className="sr-only">{t('users.recoveryCapabilityHint')}</span>
                        </span>
                      ) : null}
                    </span>
                  </th>

                  {ROLES.map((role) => {
                    const level = matrix[role][capability];
                    const busy = pending?.role === role && pending?.capability === capability;
                    return (
                      <td key={role} className="px-md py-xs align-middle">
                        {canEdit ? (
                          <Select
                            aria-label={t('users.grantFor', {
                              role: t(`users.role.${role}`),
                              capability: t(`users.capabilityName.${capability}`),
                            })}
                            fullWidth={false}
                            disabled={busy || setGrants.isPending}
                            value={level}
                            onChange={(event) =>
                              void change(role, capability, event.target.value as AccessLevel)
                            }
                          >
                            {LEVELS.map((one) => (
                              <option key={one} value={one}>
                                {t(`users.level.${one}`)}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-text-primary">{t(`users.level.${level}`)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CardBody className="shrink-0 border-t border-divider">
        <p className="flex items-start gap-xs text-caption text-text-secondary">
          <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          {canEdit ? t('users.matrixWarning') : t('users.matrixReadOnly')}
        </p>
      </CardBody>
    </Card>
  );
}
