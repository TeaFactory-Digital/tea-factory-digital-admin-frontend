/**
 * Preparing a run: one month, one method.
 *
 * Split by method because that is how the office actually pays. A bank transfer file,
 * a cheque book and a cash counter are three different things done on three different
 * days and reconciled from three different pieces of paper — one run covering all of
 * them would show a total nobody is responsible for.
 *
 * **A run needs a published month**, and the card says so instead of offering a
 * button that will answer `month-not-published`. That refusal is the module's
 * load-bearing rule: an open month's figures can still move — a rate correction, a
 * voided delivery, an approved change request — and money that has left the factory
 * cannot be re-derived.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Plus } from 'lucide-react';
import type { BillMonth, PaymentMethod, PayoutRun } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatCount, formatMonthKey } from '@/lib/format';
import { useCreatePayoutRun } from './hooks';

const METHODS: PaymentMethod[] = ['bankTransfer', 'cheque', 'cash'];

export function PreparePayoutRun({
  monthKey,
  month,
  existing,
}: {
  monthKey: string;
  month: BillMonth | undefined;
  existing: PayoutRun[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const canPrepare = useCan('payouts', 'write');
  const create = useCreatePayoutRun();

  const [method, setMethod] = useState<PaymentMethod>('bankTransfer');

  const published = month ? !month.open : false;
  const taken = new Set(existing.map((run) => run.method));
  // Every method already has a run. Nothing is wrong; there is simply nothing left
  // to prepare, and saying so is better than a button that answers `run-exists`.
  const remaining = METHODS.filter((candidate) => !taken.has(candidate));

  async function submit() {
    try {
      const run = await create.mutateAsync({ monthKey, method });
      toast.success(
        t('payouts.prepared', { method: t(`suppliers.payment.${method}`) }),
        t('payouts.preparedDetail', {
          lines: formatCount(run.payableCount),
          held: formatCount(run.heldCount),
        }),
      );
    } catch (cause) {
      toast.error(t('payouts.prepareFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('payouts.prepareTitle')}
        description={t('payouts.prepareDescription')}
      />

      <CardBody className="flex flex-col gap-md">
        {!published ? (
          <p className="flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
            <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
            {t('payouts.notPublished', { month: formatMonthKey(monthKey) })}
          </p>
        ) : month && month.billCount === 0 ? (
          <p className="rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
            {t('payouts.noBills', { month: formatMonthKey(monthKey) })}
          </p>
        ) : remaining.length === 0 ? (
          <p className="rounded-md bg-surface-variant px-md py-sm text-body-small text-text-secondary">
            {t('payouts.allMethodsPrepared')}
          </p>
        ) : canPrepare ? (
          <div className="flex flex-wrap items-end gap-sm">
            <label className="flex flex-col gap-xs text-label text-text-primary">
              {t('payouts.method')}
              <Select
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                fullWidth={false}
              >
                {remaining.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {t(`suppliers.payment.${candidate}`)}
                  </option>
                ))}
              </Select>
            </label>

            <Button
              className="mb-xxs"
              loading={create.isPending}
              iconLeft={<Plus className="size-icon-sm" aria-hidden />}
              onClick={() => void submit()}
            >
              {t('payouts.prepare')}
            </Button>

            <p className="w-full text-caption text-text-secondary">{t('payouts.prepareHint')}</p>
          </div>
        ) : (
          <p className="text-body-small text-text-secondary">{t('payouts.prepareReadOnly')}</p>
        )}

        {/**
         * §21.17, stated on the screen it blocks rather than only in the docs.
         *
         * The office will look for a download button, and the honest answer is that
         * nobody has told us what their bank accepts — SLIPS, CEFTS or a
         * bank-specific CSV — and a serialiser written against a guess is a
         * serialiser that gets thrown away. What the run gives them meanwhile is the
         * list, the total, and somewhere to record what the bank did with it.
         */}
        <p className="border-t border-divider pt-md text-caption text-text-secondary">
          {t('payouts.noFileExport')}
        </p>
      </CardBody>
    </Card>
  );
}
