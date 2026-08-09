/**
 * M2 Suppliers — one record.
 *
 * The layout follows what the office actually asks in order: who is this, how are
 * they paid, what do they owe us, and what has happened to the record. AC-01 is
 * the criterion this screen serves — "a supplier's app and their record in M2 show
 * the same active bank details, savings rate and payment method at all times" —
 * so every value here is the *active* one, and a pending change is shown as
 * pending rather than applied.
 *
 * That order is now *tabs* rather than one column. The record had grown to five
 * cards, a month history and an audit list on a single scroll, and the clerk who
 * needs the account number while the supplier is at the counter was scrolling past
 * a chart to reach it. What stays above the tabs is what is true of the supplier
 * regardless of which section is open: the name and status, a suspension reason,
 * open requests, and the queue links.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, Ban, Info, RotateCcw } from 'lucide-react';
import type { SupplierStatus } from '@tfd/domain';
import { can } from '@tfd/domain';
import { useAuthStore, useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Notice, Skeleton } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { AuditPanel } from '@/components/AuditPanel';
import { useFeatureFlags } from '@/config/RuntimeConfigProvider';
import { NAVIGATION, flagsOf } from '@/layout/navigation';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatAmount, formatDate, formatMoney } from '@/lib/format';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { RevealBankDetailsDialog } from './RevealBankDetailsDialog';
import { SupplierIncomeHistory } from './SupplierIncomeHistory';
import { SupplierNotificationsPanel } from './SupplierNotificationsPanel';
import {
  useReactivateSupplier,
  useSupplier,
  useSupplierAudit,
  useSuspendSupplier,
} from './hooks';

const STATUS_TONES = { active: 'success', suspended: 'warning', closed: 'neutral' } as const;

/**
 * The sections, in the order the office asks for them.
 *
 * `overview` is first and is the default because it answers *"is this the right
 * person"* — the question every visit to this screen starts with.
 */
const SECTIONS = ['overview', 'money', 'income', 'notifications', 'activity'] as const;
type Section = (typeof SECTIONS)[number];

export function SupplierDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { data: supplier, isPending, error, refetch } = useSupplier(id);
  const { data: audit, isPending: auditPending } = useSupplierAudit(id);
  const canEdit = useCan('suppliers', 'write');

  /**
   * In the URL, so a section is a link.
   *
   * The office works two people to a record — a clerk on the counter and whoever they
   * telephone about it — and "open his payout tab" has to be something you can paste
   * into a message. `replace: true` for the same reason the queue filters use it:
   * flicking between sections is reading, not navigating, and Back should return to
   * the supplier list rather than walk back through five tabs.
   */
  const section = (SECTIONS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Section)
    : 'overview';

  function setSection(next: string) {
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

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
            {supplier.status !== 'closed' ? (
              canEdit ? (
                <>
                  {/* §21.16, answered: a random one-time password, handed over at the
                      counter, with the identity check recorded. */}
                  <ResetPasswordDialog supplierId={supplier.id} supplierName={supplier.name} />
                  <StatusAction supplierId={supplier.id} name={supplier.name} status={supplier.status} />
                </>
              ) : (
                /**
                 * **Withheld and explained**, not withheld silently.
                 *
                 * §12.1 gives `suppliers: write` to the clerk alone — right, because these
                 * are counter acts and the clerk is who sees the supplier's face. But a
                 * manager or a factory administrator looking for the password reset and
                 * finding *nothing at all* concludes the feature is missing, which is the
                 * failure every other withheld control in this console avoids by saying
                 * whose job it is.
                 *
                 * Held to a column and marked with the info glyph, because unbounded it
                 * is two sentences of grey text sitting where a manager expects buttons
                 * — the same width every time, so the heading beside it does not move
                 * depending on who signed in.
                 */
                <p className="flex max-w-64 items-start gap-xs text-caption text-text-secondary">
                  {/* <Info className="mt-0.5 size-icon-xs shrink-0" aria-hidden />
                  {t('suppliers.detail.counterActionsHint')} */}
                </p>
              )
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
          {t('suppliers.detail.pendingRequests')}: {supplier.pendingRequests}
        </Notice>
      ) : null}

      <QuickActions supplierId={supplier.id} />

      <Tabs value={section} onValueChange={setSection}>
        <TabsList aria-label={t('suppliers.detail.sectionsLabel')}>
          {SECTIONS.map((one) => (
            <TabsTrigger key={one} value={one}>
              {t(`suppliers.detail.tab.${one}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="grid gap-lg lg:grid-cols-2">
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
        </TabsContent>

        {/* Payout, savings and credit together: they are one conversation at the
            counter — what we pay them, what we hold back, what they owe. */}
        <TabsContent value="money" className="grid gap-lg lg:grid-cols-2">
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
        </TabsContent>

        {/* Its own section: it is the longest thing on the record and carries its own
            graph/list/chart switch, which was competing with the cards above it. */}
        <TabsContent value="income">
          <SupplierIncomeHistory supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="notifications">
          <SupplierNotificationsPanel supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="activity">
          <AuditPanel
            title={t('suppliers.detail.auditTitle')}
            page={audit}
            loading={auditPending}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Every queue this supplier can be in, as cards you can hit with a mouse in a hurry.
 *
 * v1 linked to **one** of the four. The app shows a supplier their whole request
 * history in a single list (`RequestHistoryList`), and the office had to visit four
 * screens and type the supplier code into each — which in practice means checking one
 * and assuming the rest. `supplierId` was already on all four query types; only the
 * links were missing.
 *
 * They are unconditional rather than hidden when a queue is empty: "nothing
 * outstanding" is an answer a clerk needs, and a row that vanishes when the answer is
 * *no* cannot give it. Deliberately **not counts**, for the same reason — a count
 * needs four requests to render numbers that are stale the moment a colleague decides
 * something, and the queue itself answers accurately.
 *
 * The rows come from `NAVIGATION` rather than a second list of paths. That is what
 * gives each card the icon its sidebar row already has — the clerk is looking for the
 * shape they click every day, not a word — and it is why a shortcut can no longer
 * outlive the screen it opens, or offer a queue this session may not read.
 */
const QUEUE_SHORTCUTS = [
  { key: 'changeRequests', to: '/change-requests' },
  { key: 'credit', to: '/credit' },
  { key: 'teaPackets', to: '/tea-packets' },
  { key: 'inquiries', to: '/inquiries' },
] as const;

function QuickActions({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();
  const flags = useFeatureFlags();
  const grants = useAuthStore((s) => s.grants);

  const rows = NAVIGATION.flatMap((section) => section.items);

  const shortcuts = QUEUE_SHORTCUTS.flatMap(({ key, to }) => {
    const row = rows.find((item) => item.to === to);
    if (!row) return [];

    // Flag before capability, the order the sidebar uses: a feature the factory
    // never bought is not a permission question.
    const needed = flagsOf(row);
    const enabled = needed.length === 0 || needed.some((flag) => flags[flag]);
    if (!enabled || !can(grants, row.capability, 'read')) return [];

    return [{ key, to, icon: row.icon }];
  });

  if (shortcuts.length === 0) return null;

  return (
    <section aria-labelledby="supplier-quick-actions" className="flex flex-col gap-sm">
      <div>
        <h2 id="supplier-quick-actions" className="text-label text-text-primary">
          {t('suppliers.detail.quickActions')}
        </h2>
        {/* Said once, above the row, rather than as a caption repeated on four cards
            that would then be three-quarters identical text. */}
        <p className="text-caption text-text-secondary">
          {t('suppliers.detail.quickActionsHint')}
        </p>
      </div>

      <ul className="grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map(({ key, to, icon: Icon }) => (
          <li key={key}>
            <Link
              to={`${to}?supplierId=${supplierId}`}
              className="group flex items-center gap-sm rounded-lg border border-border bg-surface p-sm transition-colors hover:border-primary hover:bg-surface-variant"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary"
              >
                <Icon className="size-icon-sm" />
              </span>
              <span className="min-w-0 flex-1 truncate text-body-small text-text-primary">
                {t(`suppliers.detail.queue.${key}`)}
              </span>
              <ArrowRight
                aria-hidden
                className="size-icon-xs shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
