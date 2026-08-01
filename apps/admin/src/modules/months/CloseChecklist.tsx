/**
 * The close checklist — the control AC-04 is about.
 *
 * modules.md: a month close *"needs a checklist that will not let the accountant
 * past an unresolved exception"*. So the button is not merely disabled: each step
 * states **what is blocking it and where to go**, because "Publish (disabled)" with
 * no reason is a support call, and a tooltip is a reason nobody reads.
 *
 * Publishing is the one irreversible act in the console. Three things follow:
 *
 *  - It sits behind a **confirmation that repeats the figures** — the month, the
 *    total kilos and the rate the bills will be built from. A confirmation that
 *    only says "are you sure" is a click, not a check.
 *  - It requires `ratesAndMonthClose: approve`, which §12.1 gives the manager and
 *    not the accountant who enters the rate.
 *  - Even for a manager it is refused when they entered that rate themselves
 *    (BR-501) — the server decides, and the screen says so before they try.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, CircleAlert, Lock } from 'lucide-react';
import type { MonthSummary } from '@tfd/domain';
import { round2 } from '@tfd/domain';
import { useAuthStore, useCan } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatCount, formatDateTime, formatKg, formatMoney, formatMonthKey } from '@/lib/format';
import { useBillRun } from '@/modules/bills/hooks';
import { usePublishMonth } from './hooks';

interface Step {
  key: string;
  done: boolean;
  label: string;
  detail: string;
  /** Where to go and do it. A blocked step with no link is a puzzle, not a task. */
  href?: string;
  hrefLabel?: string;
}

export function CloseChecklist({ month }: { month: MonthSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const canPublish = useCan('ratesAndMonthClose', 'approve');
  const userId = useAuthStore((s) => s.user?.id);
  const publish = usePublishMonth(month.monthKey);
  /**
   * M5's run, read from M4.
   *
   * The dependency runs this way round on purpose: the *close* is what needs to know
   * whether bills exist, and inverting it would mean the bills module deciding when a
   * month may be published — which is M4's job and where the four-eyes rule lives.
   */
  const run = useBillRun(month.monthKey);

  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');

  /**
   * The four-eyes check, run in the console so the manager is told *before* they
   * commit to a dialog. The server refuses regardless (BR-501) — the console can
   * be lied to about who entered a rate.
   */
  const wouldBeSelfApproval = Boolean(month.rate && userId && month.rate.enteredById === userId);

  const steps: Step[] = [
    {
      key: 'leaf',
      done: month.deliveryCount > 0,
      label: t('months.step.leaf'),
      detail: t('months.step.leafDetail', {
        kgs: formatKg(month.totalKgs),
        suppliers: formatCount(month.supplierCount),
        deliveries: formatCount(month.deliveryCount),
      }),
    },
    {
      key: 'rate',
      done: month.rate !== null,
      label: t('months.step.rate'),
      detail: month.rate
        ? t('months.step.rateDetail', {
            total: formatMoney(round2(month.rate.ratePerKg + month.rate.extraRatePerKg)),
            name: month.rate.enteredByName,
          })
        : t('months.step.rateMissing'),
    },
    {
      key: 'exceptions',
      done: month.openExceptions === 0,
      label: t('months.step.exceptions'),
      detail:
        month.openExceptions === 0
          ? t('months.step.exceptionsClear', { total: formatCount(month.totalExceptions) })
          : t('months.step.exceptionsOpen', { count: month.openExceptions }),
    },
    /**
     * The step that fills §13's `billsGenerated` stage.
     *
     * Publishing is what turns a generated bill into the document a supplier holds,
     * so a month with no run has nothing to hand over — and one whose run is
     * **stale** would hand over figures that disagree with the leaf it closed on.
     * Both are refused by the server (`bills-missing`, `bills-stale`); this is where
     * the manager is told which, and where to go and fix it.
     */
    {
      key: 'bills',
      done: Boolean(run.data) && !run.data?.stale,
      label: t('months.step.bills'),
      detail: run.data
        ? run.data.stale
          ? t('months.step.billsStale')
          : t('months.step.billsDetail', {
              count: formatCount(run.data.billCount),
              payable: formatMoney(run.data.payableTotal),
            })
        : t('months.step.billsMissing'),
      href: `/bills?month=${month.monthKey}`,
      hrefLabel: t('months.step.openBills'),
    },
  ];

  const blocked = steps.some((step) => !step.done) || wouldBeSelfApproval;

  async function submit() {
    try {
      await publish.mutateAsync(note.trim() || undefined);
      setConfirming(false);
      setNote('');
      toast.success(t('months.published', { month: formatMonthKey(month.monthKey) }));
    } catch (cause) {
      // The dialog stays open: `exceptions-open` or a four-eyes refusal is
      // information about what to do next, not a toast over a closed dialog.
      toast.error(t('months.publishFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('months.closeTitle')}
        description={month.open ? t('months.closeDescription') : t('months.closedDescription')}
      />

      <CardBody className="flex flex-col gap-md">
        {/**
         * The steps are a **pre-publish** control, so a closed month does not show
         * them. It reads badly and it misleads: a month published before the
         * fixture's delivery window shows "Leaf recorded — not done yet", which
         * invites somebody to go looking for leaf that was never missing. What a
         * closed month owes the reader is the rate it closed on and who closed it.
         */}
        {month.open ? (
          <ol className="flex flex-col gap-sm">
            {steps.map((step) => (
              <li key={step.key} className="flex items-start gap-sm">
                <span
                  aria-hidden
                  className={
                    step.done
                      ? 'mt-xxs flex size-5 shrink-0 items-center justify-center rounded-full bg-success-muted text-success'
                      : 'mt-xxs flex size-5 shrink-0 items-center justify-center rounded-full bg-warning-muted text-warning'
                  }
                >
                  {step.done ? (
                    <Check className="size-icon-xs" />
                  ) : (
                    <CircleAlert className="size-icon-xs" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-small font-medium text-text-primary">
                    {step.label}
                    <span className="sr-only">
                      {step.done ? t('months.stepDone') : t('months.stepBlocked')}
                    </span>
                  </span>
                  <span className="text-caption text-text-secondary">{step.detail}</span>
                  {/* Where to go and do it. A blocked step that only states the
                      problem leaves the reader hunting for the screen that fixes it. */}
                  {step.href && step.hrefLabel ? (
                    <Link
                      to={step.href}
                      className="text-caption text-primary underline-offset-2 hover:underline"
                    >
                      {step.hrefLabel}
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {!month.open ? (
          <p className="flex items-start gap-xs rounded-md bg-surface-variant px-md py-sm text-body-small text-text-secondary">
            <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
            {t('months.alreadyPublished', {
              name: month.publishedByName ?? '—',
              date: formatDateTime(month.publishedAt),
            })}
          </p>
        ) : canPublish ? (
          <div className="flex flex-col gap-xs border-t border-divider pt-md">
            <Button variant="primary" disabled={blocked} onClick={() => setConfirming(true)}>
              {t('months.publish', { month: formatMonthKey(month.monthKey) })}
            </Button>
            {/* The reason it is disabled, in words, next to the control. */}
            {wouldBeSelfApproval ? (
              <p className="text-caption text-warning">{t('months.fourEyesHint')}</p>
            ) : blocked ? (
              <p className="text-caption text-text-secondary">{t('months.blockedHint')}</p>
            ) : (
              <p className="text-caption text-text-secondary">{t('months.irreversibleHint')}</p>
            )}
          </div>
        ) : (
          <p className="border-t border-divider pt-md text-caption text-text-secondary">
            {t('months.publishNeedsManager')}
          </p>
        )}
      </CardBody>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(false);
        }}
        title={t('months.confirmTitle', { month: formatMonthKey(month.monthKey) })}
        description={t('months.confirmDescription')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={publish.isPending} onClick={() => void submit()}>
              {t('months.confirmPublish')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {/* The figures, repeated. This is the last screen before the month
              becomes the record every bill and payout is built from. */}
          <dl className="flex flex-col gap-xs rounded-md bg-surface-variant px-md py-sm text-body-small">
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('months.totalKgs')}</dt>
              <dd className="numeric font-semibold text-text-primary">
                {formatKg(month.totalKgs)}
              </dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('months.suppliers')}</dt>
              <dd className="numeric text-text-primary">{formatCount(month.supplierCount)}</dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt className="text-text-secondary">{t('months.totalPerKg')}</dt>
              <dd className="numeric font-semibold text-text-primary">
                {month.rate
                  ? formatMoney(round2(month.rate.ratePerKg + month.rate.extraRatePerKg))
                  : '—'}
              </dd>
            </div>
          </dl>

          <Field label={t('common.note')} hint={t('months.publishNoteHint')}>
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
