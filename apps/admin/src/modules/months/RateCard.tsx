/**
 * The auction rate for a month.
 *
 * Two figures, not one: the rate the auction produced and the extra the factory
 * adds. The app shows the sum and the bill itemizes both, so the office enters
 * both — collapsing them would lose a number the supplier is entitled to see.
 *
 * **A rate is a correction until the month is published.** Re-entering it is
 * normal, not exceptional: the auction result is read off a fax and mistyped, and
 * the alternative to editing is a month closed on the wrong figure. After the
 * publish it is immutable (BR-108) and the form is not rendered at all.
 *
 * The **total per kilo is shown live** as the accountant types, because that is the
 * figure they are checking against the auction sheet — and it is the one a bill
 * will be built from.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import type { MonthSummary } from '@tfd/domain';
import { round2 } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useSetMonthlyRate } from './hooks';

export function RateCard({ month }: { month: MonthSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const canEnter = useCan('ratesAndMonthClose', 'write');
  const setRate = useSetMonthlyRate(month.monthKey);

  const [ratePerKg, setRatePerKg] = useState('');
  const [extraRatePerKg, setExtraRatePerKg] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * The fields follow the month, not the mount: switching from July to June must
   * not leave July's figures in the boxes, which would be a rate about to be saved
   * against the wrong month.
   */
  useEffect(() => {
    setRatePerKg(month.rate ? String(month.rate.ratePerKg) : '');
    setExtraRatePerKg(month.rate ? String(month.rate.extraRatePerKg) : '');
    setError(null);
  }, [month.monthKey, month.rate]);

  const rate = Number(ratePerKg);
  const extra = Number(extraRatePerKg || 0);
  const total = Number.isFinite(rate) && Number.isFinite(extra) ? round2(rate + extra) : null;

  async function submit() {
    if (!Number.isFinite(rate) || rate <= 0) {
      setError(t('months.error.ratePositive'));
      return;
    }
    if (!Number.isFinite(extra) || extra < 0) {
      setError(t('months.error.extraNonNegative'));
      return;
    }
    if (round2(rate) !== rate || round2(extra) !== extra) {
      setError(t('months.error.moneyScale'));
      return;
    }

    try {
      await setRate.mutateAsync({ ratePerKg: rate, extraRatePerKg: extra });
      setError(null);
      toast.success(t('months.rateSaved', { month: month.monthKey }));
    } catch (cause) {
      toast.error(t('months.rateFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('months.rateTitle')}
        description={t('months.rateDescription')}
        actions={
          month.rate ? (
            <span className="numeric text-h3 text-text-primary">
              {formatMoney(round2(month.rate.ratePerKg + month.rate.extraRatePerKg))}
              <span className="ml-xxs text-caption text-text-secondary">
                {t('months.perKg')}
              </span>
            </span>
          ) : null
        }
      />

      <CardBody className="flex flex-col gap-md">
        {month.rate ? (
          <dl>
            <DetailRow label={t('months.ratePerKg')} value={formatMoney(month.rate.ratePerKg)} numeric />
            <DetailRow
              label={t('months.extraRatePerKg')}
              value={formatMoney(month.rate.extraRatePerKg)}
              numeric
            />
            {/* Who entered it is half of the four-eyes rule, so it is on the card
                rather than only in the audit log: the manager about to publish is
                the person who needs to see it. */}
            <DetailRow
              label={t('months.enteredBy')}
              value={`${month.rate.enteredByName} · ${formatDateTime(month.rate.enteredAt)}`}
            />
          </dl>
        ) : (
          <p className="text-body-small text-text-secondary">
            {t('months.noRateYet', { month: month.monthKey })}
          </p>
        )}

        {!month.open ? (
          <p className="flex items-start gap-xs rounded-md bg-surface-variant px-md py-sm text-body-small text-text-secondary">
            <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
            {t('months.rateLocked')}
          </p>
        ) : canEnter ? (
          <div className="flex flex-wrap items-end gap-sm border-t border-divider pt-md">
            <Field
              label={t('months.ratePerKg')}
              className="w-40"
              error={error ?? undefined}
              hint={t('months.ratePerKgHint')}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  inputMode="decimal"
                  className="numeric"
                  value={ratePerKg}
                  onChange={(event) => {
                    setRatePerKg(event.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                />
              )}
            </Field>

            <Field label={t('months.extraRatePerKg')} className="w-40" hint={t('months.extraHint')}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  className="numeric"
                  value={extraRatePerKg}
                  onChange={(event) => {
                    setExtraRatePerKg(event.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                />
              )}
            </Field>

            {/* The figure being checked against the auction sheet. */}
            <div className="flex flex-col pb-sm">
              <span className="text-caption text-text-secondary">{t('months.totalPerKg')}</span>
              <span className="numeric text-subtitle font-semibold text-text-primary">
                {total === null ? '—' : formatMoney(total)}
              </span>
            </div>

            <Button className="mb-sm" loading={setRate.isPending} onClick={() => void submit()}>
              {month.rate ? t('months.updateRate') : t('months.saveRate')}
            </Button>
          </div>
        ) : (
          <p className="border-t border-divider pt-md text-body-small text-text-secondary">
            {t('months.rateReadOnly')}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
