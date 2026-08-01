/**
 * The generation run: what was built, from what, and whether it still matches.
 *
 * This card is where §13's empty `billsGenerated` stage gets occupied, and it is
 * built around one property of a read model: **re-generating is normal.** The auction
 * rate gets corrected, a delivery gets voided, a change request is approved — and the
 * bills have to be rebuilt. So the button is not a one-shot "generate"; it is
 * "recompute", offered as long as the month is open.
 *
 * Three states the accountant has to be able to tell apart, because their next action
 * differs in each:
 *
 *  - **No run** — nothing to check yet. Say what a run needs (a rate) rather than
 *    offering a button that will answer `rate-missing`.
 *  - **Stale** — a run exists and the leaf has moved under it. This is the state the
 *    card exists for: the figures on screen are real but out of date, and publishing
 *    on them would freeze the wrong ones. Refused by the server too (`bills-stale`).
 *  - **Published** — the bills are the documents suppliers hold. Nothing to do, and
 *    no button, because BR-108 means the server would refuse.
 */

import { useTranslation } from 'react-i18next';
import { FileText, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import type { BillMonth, BillRun } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatCount, formatDateTime, formatKg, formatMoney, formatMonthKey } from '@/lib/format';
import { isApiError } from '@/services/api/errors';
import { useGenerateBills } from './hooks';

export function BillRunCard({
  monthKey,
  month,
  run,
  runError,
}: {
  monthKey: string;
  month: BillMonth | undefined;
  run: BillRun | undefined;
  runError: unknown;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const canGenerate = useCan('billing', 'write');
  const generate = useGenerateBills(monthKey);

  const open = month?.open ?? false;
  /**
   * `bills-missing` is a **state, not a failure**: most months begin without a run.
   * Any other error is a real one and still has to reach the reader.
   */
  const notGenerated = isApiError(runError) && runError.code === 'bills-missing';
  const otherError = runError && !notGenerated ? runError : null;

  async function submit() {
    try {
      const result = await generate.mutateAsync();
      toast.success(
        t('bills.generated', { month: formatMonthKey(monthKey) }),
        t('bills.generatedDetail', {
          count: formatCount(result.billCount),
          payable: formatMoney(result.payableTotal),
        }),
      );
    } catch (cause) {
      toast.error(t('bills.generateFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('bills.runTitle')}
        description={open ? t('bills.runDescription') : t('bills.runDescriptionClosed')}
        actions={
          run ? (
            <span className="numeric text-h3 text-text-primary">
              {formatMoney(run.payableTotal)}
              <span className="ml-xxs text-caption text-text-secondary">
                {t('bills.payableLabel')}
              </span>
            </span>
          ) : null
        }
      />

      <CardBody className="flex flex-col gap-md">
        {otherError ? (
          <p role="alert" className="text-body-small text-error">
            {t(errorMessageKey(otherError))}
          </p>
        ) : null}

        {run ? (
          <>
            <dl className="grid grid-cols-2 gap-x-lg gap-y-xs sm:grid-cols-3">
              <Figure label={t('bills.runBills')} value={formatCount(run.billCount)} />
              <Figure label={t('bills.runKgs')} value={formatKg(run.totalKgs)} />
              <Figure label={t('bills.runGross')} value={formatMoney(run.grossTotal)} />
              <Figure label={t('bills.runDeductions')} value={formatMoney(run.deductionsTotal)} />
              <Figure label={t('bills.runSavings')} value={formatMoney(run.savingsTotal)} />
              <Figure label={t('bills.runCarryingDebt')} value={formatCount(run.carryingDebt)} />
            </dl>

            <p className="text-caption text-text-secondary">
              {t('bills.runGeneratedBy', {
                name: run.generatedByName,
                when: formatDateTime(run.generatedAt),
              })}
            </p>

            {/* Payable, with nowhere to pay it. Stated on the card the accountant is
                about to sign off, not left to be discovered inside a payout run. */}
            {run.missingBankDetails > 0 ? (
              <p className="flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
                <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('bills.missingBankWarning', { count: run.missingBankDetails })}
              </p>
            ) : null}

            {/* The state this card exists for. */}
            {run.stale ? (
              <p className="flex items-start gap-xs rounded-md bg-error-muted px-md py-sm text-body-small text-error">
                <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('bills.staleWarning', { kgs: formatKg(run.totalKgs) })}
              </p>
            ) : null}
          </>
        ) : notGenerated ? (
          <p className="flex items-start gap-xs text-body-small text-text-secondary">
            <FileText className="mt-xxs size-icon-sm shrink-0" aria-hidden />
            {t('bills.notGenerated', { month: formatMonthKey(monthKey) })}
          </p>
        ) : null}

        {!open ? (
          <p className="flex items-start gap-xs rounded-md bg-surface-variant px-md py-sm text-body-small text-text-secondary">
            <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
            {t('bills.publishedLock')}
          </p>
        ) : canGenerate ? (
          <div className="flex flex-col gap-xs border-t border-divider pt-md">
            <Button
              variant={run?.stale ? 'primary' : 'secondary'}
              loading={generate.isPending}
              iconLeft={<RefreshCw className="size-icon-sm" aria-hidden />}
              onClick={() => void submit()}
            >
              {run ? t('bills.regenerate') : t('bills.generate')}
            </Button>
            <p className="text-caption text-text-secondary">
              {run ? t('bills.regenerateHint') : t('bills.generateHint')}
            </p>
          </div>
        ) : (
          <p className="border-t border-divider pt-md text-caption text-text-secondary">
            {t('bills.generateReadOnly')}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-text-secondary">{label}</dt>
      <dd className="numeric text-subtitle text-text-primary">{value}</dd>
    </div>
  );
}
