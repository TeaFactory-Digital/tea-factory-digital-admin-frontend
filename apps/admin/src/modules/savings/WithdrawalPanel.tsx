/**
 * Taking savings out — **§21.9, as the factory answered it.**
 *
 * *A supplier may take their savings out, normally in April; the month must be changeable;
 * interest is changeable too and starts at 0% a year; and the money is paid on the next
 * Green Leaf Account.*
 *
 * Three consequences of that last clause shape this panel, and none of them is decoration:
 *
 *  - **Nothing here moves money.** It records a request. The balance above it does not
 *    change, the passbook gains no row, and both happen when M5's bill is published — so
 *    the panel says *when* the supplier will actually be paid, because "recorded" and
 *    "paid" are a month apart and a clerk who conflates them tells a supplier the wrong
 *    thing at the counter.
 *  - **The window is the factory's month, not the browser's** (BR-104). Out of season the
 *    control is withheld and the month is named, rather than offered and refused.
 *  - **What may be asked for is the balance less what is already pending**, because a
 *    request does not reduce the balance until it is paid. Without that, the same savings
 *    could be asked for twice in one window and both would look fundable.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Undo2 } from 'lucide-react';
import { availableToWithdraw, withdrawalProblems, type SavingsAccount } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatAmount, formatDate, formatMonthKey, formatMonthName } from '@/lib/format';
import { useCancelWithdrawal, useRequestWithdrawal, useSavingsWithdrawals } from './hooks';

const REASON_MIN = 10;

export function WithdrawalPanel({ account }: { account: SavingsAccount }) {
  const { t } = useTranslation();
  const toast = useToast();
  // §12.1 calls the capability "Bills & savings". A clerk reads a passbook; the accountant
  // moves what is in it.
  const canEdit = useCan('billing', 'write');

  const query = useSavingsWithdrawals(account.supplierId);
  const request = useRequestWithdrawal(account.supplierId);
  const cancel = useCancelWithdrawal(account.supplierId);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  if (query.isPending) {
    return (
      <div className="mt-md flex justify-center py-lg">
        <Spinner />
      </div>
    );
  }
  if (query.error || !query.data) return null;

  const state = query.data;
  const pending = state.items.filter((one) => one.status === 'pending');
  const settled = state.items.filter((one) => one.status !== 'pending');

  const parsed = Number(amount);
  const problems = withdrawalProblems({
    amount: parsed,
    balance: state.balance,
    pendingTotal: state.pendingTotal,
    policy: state.policy,
    now: new Date(),
  });
  // Only what the *typed figure* is wrong about. A shut window or an empty account is
  // already said above the form, and repeating it under the field would read as two
  // problems where there is one.
  const amountProblem = problems.find(
    (one) => one === 'not-positive' || one === 'exceeds-available',
  );
  const reasonTooShort = reason.trim().length < REASON_MIN;

  async function submit() {
    try {
      await request.mutateAsync({ amount: parsed, reason: reason.trim(), context: state });
      setAmount('');
      setReason('');
      toast.success(
        t('savings.withdrawalRecorded', { amount: formatAmount(parsed) }),
        t('savings.withdrawalRecordedHint'),
      );
    } catch (cause) {
      toast.error(t('savings.withdrawalFailed'), t(errorMessageKey(cause)));
    }
  }

  async function submitCancel(id: string) {
    try {
      await cancel.mutateAsync({ id, reason: cancelReason.trim() });
      setCancelling(null);
      setCancelReason('');
      toast.success(t('savings.withdrawalCancelled'));
    } catch (cause) {
      toast.error(t('savings.withdrawalCancelFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <section className="mt-lg flex flex-col gap-md border-t border-divider pt-md">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <h3 className="text-subtitle text-text-primary">{t('savings.withdrawalsTitle')}</h3>
        {/* The rule, always visible — in or out of season. An office that only sees it in
            April cannot answer the question in March. */}
        <Badge tone={state.windowOpen ? 'success' : 'neutral'}>
          {state.windowOpen
            ? t('savings.windowOpen', { month: formatMonthName(state.policy.withdrawalMonth) })
            : t('savings.windowClosed', { month: formatMonthName(state.policy.withdrawalMonth) })}
        </Badge>
      </div>

      {/**
       * What may be asked for, and it is **not** the balance when something is pending.
       *
       * Shown as its own figure rather than left for the refusal to explain: an accountant
       * typing the balance they can see above and being told it is too much would be right
       * to think the screen was wrong.
       */}
      {state.pendingTotal > 0 ? (
        <p className="text-caption text-text-secondary">
          {t('savings.availableAfterPending', {
            available: formatAmount(availableToWithdraw(state.balance, state.pendingTotal)),
            pending: formatAmount(state.pendingTotal),
          })}
        </p>
      ) : null}

      {/* Pending requests, with what pays them and when. */}
      {pending.length > 0 ? (
        <ul className="flex flex-col gap-xs">
          {pending.map((one) => (
            <li
              key={one.id}
              className="flex flex-col gap-xs rounded-md bg-surface-variant px-md py-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <span className="numeric text-body-small font-semibold text-text-primary">
                  {formatAmount(one.amount)}
                </span>
                <Badge tone="warning">{t('savings.awaitingBill')}</Badge>
              </div>
              <p className="text-caption text-text-secondary">
                {t('savings.requestedBy', {
                  name: one.requestedByName,
                  when: formatDate(one.requestedAt),
                })}
                {' · '}
                {one.reason}
              </p>

              {canEdit && cancelling !== one.id ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  iconLeft={<Undo2 className="size-icon-sm" aria-hidden />}
                  onClick={() => setCancelling(one.id)}
                >
                  {t('savings.cancelWithdrawal')}
                </Button>
              ) : null}

              {cancelling === one.id ? (
                <div className="flex flex-col gap-xs">
                  {/* Cancelled, never deleted — the supplier was told it was arranged. */}
                  <Field label={t('common.reason')} required hint={t('savings.cancelReasonHint')}>
                    {({ id, describedBy, required }) => (
                      <Textarea
                        id={id}
                        aria-describedby={describedBy}
                        required={required}
                        rows={2}
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                      />
                    )}
                  </Field>
                  <div className="flex flex-wrap gap-xs">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={cancelReason.trim().length < REASON_MIN}
                      loading={cancel.isPending}
                      onClick={() => void submitCancel(one.id)}
                    >
                      {t('savings.cancelConfirm')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setCancelling(null);
                        setCancelReason('');
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* The form, only in season and only for somebody who may move money. */}
      {!canEdit ? (
        <p className="text-caption text-text-secondary">{t('savings.withdrawalReadOnly')}</p>
      ) : !state.windowOpen ? (
        // Withheld and explained, rather than offered and refused: out of season there is
        // nothing the office can do here, and a disabled form invites them to try.
        <p className="rounded-md bg-surface-variant px-md py-sm text-caption text-text-secondary">
          {t('savings.windowClosedHint', {
            month: formatMonthName(state.policy.withdrawalMonth),
          })}
        </p>
      ) : state.balance <= 0 ? (
        <p className="text-caption text-text-secondary">{t('savings.nothingToWithdraw')}</p>
      ) : (
        <div className="flex flex-col gap-sm">
          <div className="grid gap-md md:grid-cols-2">
            <Field
              label={t('savings.withdrawAmount')}
              required
              error={amountProblem ? t(`savings.problem.${amountProblem}`) : undefined}
              hint={t('savings.withdrawAmountHint', {
                available: formatAmount(
                  availableToWithdraw(state.balance, state.pendingTotal),
                ),
              })}
            >
              {({ id, describedBy, invalid, required }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  type="number"
                  min={0}
                  step={0.01}
                  className="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              )}
            </Field>

            <Field
              label={t('common.reason')}
              required
              hint={t('savings.withdrawReasonHint', { min: REASON_MIN })}
            >
              {({ id, describedBy, required }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  required={required}
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            <Button
              variant="primary"
              disabled={problems.length > 0 || reasonTooShort}
              loading={request.isPending}
              iconLeft={<Banknote className="size-icon-sm" aria-hidden />}
              onClick={() => void submit()}
            >
              {t('savings.recordWithdrawal')}
            </Button>
            {/* When the supplier is actually paid. The whole reason this is a *request*. */}
            <p className="text-caption text-text-secondary">{t('savings.paidOnNextBill')}</p>
          </div>
        </div>
      )}

      {/* What has already been paid, so the counter can answer "did I get it?". */}
      {settled.length > 0 ? (
        <ul className="flex flex-col gap-xxs">
          {settled.map((one) => (
            <li key={one.id} className="flex flex-wrap items-center gap-xs text-caption">
              <span className="numeric text-text-primary">{formatAmount(one.amount)}</span>
              <span className="text-text-secondary">
                {one.status === 'settled'
                  ? t('savings.paidOn', { month: formatMonthKey(one.settledMonthKey) })
                  : t('savings.wasCancelled')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/**
       * The half of §21.9 that is still open, said here rather than only in the docs.
       *
       * The factory set a rate; nobody has said what it is calculated on. Simple or
       * compound, closing balance or the year's minimum — those pay materially different
       * money, so the console stores the rate, shows it, and posts nothing of its own.
       */}
      {state.policy.annualInterestRate > 0 ? (
        <p className="text-caption text-text-secondary">
          {t('savings.interestNote', { rate: formatAmount(state.policy.annualInterestRate) })}
        </p>
      ) : null}
    </section>
  );
}
