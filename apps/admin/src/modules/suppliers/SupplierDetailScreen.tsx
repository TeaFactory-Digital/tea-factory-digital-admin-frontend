/**
 * M2 Suppliers — one record.
 *
 * The layout follows what the office actually asks in order: who is this, how are
 * they paid, what do they owe us, and what has happened to the record. AC-01 is
 * the criterion this screen serves — "a supplier's app and their record in M2 show
 * the same active bank details, savings rate and payment method at all times" —
 * so every value here is the *active* one, and a pending change is shown as
 * pending rather than applied.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import type { SupplierStatus } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { AuditPanel } from '@/components/AuditPanel';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatAmount, formatDate, formatMoney } from '@/lib/format';
import { RevealBankDetailsDialog } from './RevealBankDetailsDialog';
import {
  useReactivateSupplier,
  useSupplier,
  useSupplierAudit,
  useSuspendSupplier,
} from './hooks';

const STATUS_TONES = { active: 'success', suspended: 'warning', closed: 'neutral' } as const;

export function SupplierDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: supplier, isPending, error, refetch } = useSupplier(id);
  const { data: audit, isPending: auditPending } = useSupplierAudit(id);
  const canEdit = useCan('suppliers', 'write');

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending || !supplier) return <DetailSkeleton />;

  return (
    <>
      <PageHeader
        title={supplier.name}
        description={supplier.supplierCode}
        breadcrumb={
          <Link to="/suppliers" className="hover:text-text-primary">
            {t('suppliers.title')}
          </Link>
        }
        actions={
          <>
            <Badge tone={STATUS_TONES[supplier.status as SupplierStatus]}>
              {t(`suppliers.status.${supplier.status}`)}
            </Badge>
            {canEdit && supplier.status !== 'closed' ? (
              <StatusAction supplierId={supplier.id} name={supplier.name} status={supplier.status} />
            ) : null}
          </>
        }
      />

      {supplier.status === 'suspended' && supplier.suspendedReason ? (
        <Notice tone="warning">
          {t('suppliers.detail.suspendedBecause', { reason: supplier.suspendedReason })}
        </Notice>
      ) : null}

      {supplier.pendingRequests > 0 ? (
        <Notice tone="info">
          <Link
            to={`/change-requests?supplierId=${supplier.id}&status=pending`}
            className="underline"
          >
            {t('suppliers.detail.pendingRequests')}: {supplier.pendingRequests}
          </Link>
        </Notice>
      ) : null}

      <div className="grid gap-lg lg:grid-cols-2">
        <Card>
          <CardHeader title={t('suppliers.detail.profile')} />
          <CardBody>
            <dl className="divide-y divide-divider">
              <DetailRow label={t('suppliers.column.nic')} value={supplier.nic} numeric />
              <DetailRow
                label={t('suppliers.detail.phone')}
                value={supplier.phone ?? t('common.notAvailable')}
                numeric
              />
              <DetailRow
                label={t('suppliers.detail.email')}
                value={supplier.email ?? t('common.notAvailable')}
              />
              <DetailRow
                label={t('suppliers.detail.dateOfBirth')}
                value={formatDate(supplier.dateOfBirth)}
                numeric
              />
              <DetailRow
                label={t('suppliers.detail.homeAddress')}
                value={supplier.homeAddress ?? t('common.notAvailable')}
              />
              <DetailRow
                label={t('suppliers.detail.registered')}
                value={formatDate(supplier.registeredAt)}
                numeric
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('suppliers.detail.estate')} />
          <CardBody>
            <dl className="divide-y divide-divider">
              <DetailRow
                label={t('suppliers.column.point')}
                value={supplier.collectionPoint}
              />
              <DetailRow
                label={t('suppliers.detail.estateAddress')}
                value={supplier.estateAddress ?? t('common.notAvailable')}
              />
              <DetailRow
                label={t('suppliers.column.lastDelivery')}
                value={formatDate(supplier.lastDeliveryAt)}
                numeric
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('suppliers.detail.payout')}
            actions={
              supplier.bankDetails ? <RevealBankDetailsDialog supplierId={supplier.id} /> : null
            }
          />
          <CardBody>
            {supplier.bankDetails ? (
              <dl className="divide-y divide-divider">
                <DetailRow
                  label={t('suppliers.column.payment')}
                  value={t(`suppliers.payment.${supplier.paymentMethod}`)}
                />
                <DetailRow
                  label={t('suppliers.detail.bank')}
                  value={supplier.bankDetails.bankName}
                />
                <DetailRow
                  label={t('suppliers.detail.branch')}
                  value={supplier.bankDetails.branchName}
                />
                {/* Masked, and it arrives masked from the server — this is not a
                    display choice the console could get wrong (§20.4). */}
                <DetailRow
                  label={t('suppliers.detail.accountNumber')}
                  value={supplier.bankDetails.accountNumber}
                  numeric
                />
              </dl>
            ) : (
              <Notice tone="warning">{t('suppliers.noBankDetails')}</Notice>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('suppliers.detail.savings')} />
          <CardBody>
            <dl className="divide-y divide-divider">
              <DetailRow
                label={t('suppliers.detail.savingsRate')}
                value={
                  supplier.savingsPerKg === 0
                    ? t('suppliers.optedOut')
                    : formatAmount(supplier.savingsPerKg)
                }
                numeric
              />
              <DetailRow
                label={t('suppliers.detail.savingsBalance')}
                value={formatMoney(supplier.savingsBalance)}
                numeric
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('suppliers.detail.credit')} />
          <CardBody>
            <dl className="divide-y divide-divider">
              <DetailRow
                label={t('suppliers.detail.creditAdvance')}
                value={formatMoney(supplier.creditBalances.advance)}
                numeric
              />
              <DetailRow
                label={t('suppliers.detail.creditLoan')}
                value={formatMoney(supplier.creditBalances.loan)}
                numeric
              />
              <DetailRow
                label={t('suppliers.detail.creditManure')}
                value={formatMoney(supplier.creditBalances.manure)}
                numeric
              />
            </dl>
          </CardBody>
        </Card>

        <AuditPanel
          title={t('suppliers.detail.auditTitle')}
          page={audit}
          loading={auditPending}
        />
      </div>
    </>
  );
}

/**
 * Suspend / reactivate, both behind a reason.
 *
 * A supplier who finds their account suspended will telephone the office, and
 * "suspended on the 14th" with no why is a conversation nobody there can have.
 * Same principle as AC-06 for a rejection note.
 */
function StatusAction({
  supplierId,
  name,
  status,
}: {
  supplierId: string;
  name: string;
  status: SupplierStatus;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const suspending = status === 'active';
  const suspend = useSuspendSupplier(supplierId);
  const reactivate = useReactivateSupplier(supplierId);
  const mutation = suspending ? suspend : reactivate;

  function close() {
    setOpen(false);
    setReason('');
    mutation.reset();
  }

  function submit() {
    mutation.mutate(reason.trim(), {
      onSuccess: () => {
        toast.success(
          suspending ? t('suppliers.action.suspend') : t('suppliers.action.reactivate'),
        );
        close();
      },
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={suspending ? 'danger' : 'secondary'}
        iconLeft={
          suspending ? (
            <Ban className="size-icon-sm" aria-hidden />
          ) : (
            <RotateCcw className="size-icon-sm" aria-hidden />
          )
        }
        onClick={() => setOpen(true)}
      >
        {suspending ? t('suppliers.action.suspend') : t('suppliers.action.reactivate')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={
          suspending
            ? t('suppliers.suspend.title', { name })
            : t('suppliers.reactivate.title', { name })
        }
        description={suspending ? t('suppliers.suspend.body') : t('suppliers.reactivate.body')}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={suspending ? 'danger' : 'primary'}
              loading={mutation.isPending}
              disabled={reason.trim().length < 10}
              onClick={submit}
            >
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <Field
          label={t('suppliers.reasonLabel')}
          required
          error={mutation.error ? t(errorMessageKey(mutation.error)) : undefined}
        >
          {({ id, describedBy, invalid, required }) => (
            <Textarea
              id={id}
              autoFocus
              value={reason}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-lg">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-lg lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}
