/**
 * The eligibility working, shown rather than summarised.
 *
 * This component **is** AC-05. The criterion is that the figures in a credit queue
 * match `GET /advances|loans|manure/eligibility` for that supplier byte for byte,
 * *including the working* — and the reason it is a criterion at all is that the
 * supplier is looking at the same numbers on their phone. An approver who sees only
 * "ceiling: LKR 48,200" cannot answer "the app said I could have more", and every
 * rejection where the two disagree becomes a dispute the office loses.
 *
 * So the panel prints the arithmetic in the order the rule reads it, from the
 * server's own fields. Nothing here is re-derived in the browser: a second
 * implementation of a ceiling is the thing this whole module is arranged to avoid.
 */

import { useTranslation } from 'react-i18next';
import type { CreditEligibility } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Notice } from '@/components/ui/states';
import { formatAmount, formatDateTime, formatKg, formatMonthKey, NOT_AVAILABLE } from '@/lib/format';

/** The three figures the decision actually turns on. */
function Figure({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'strong';
}) {
  return (
    <div className="flex flex-col gap-xxs">
      <p className="text-overline text-text-secondary uppercase">{label}</p>
      <p
        className={
          tone === 'strong'
            ? 'numeric text-h4 font-semibold text-text-primary'
            : tone === 'muted'
              ? 'numeric text-subtitle text-text-secondary'
              : 'numeric text-subtitle text-text-primary'
        }
      >
        {value}
      </p>
    </div>
  );
}

export function EligibilityPanel({
  eligibility,
  /** The amount asked for, so the panel can say whether it fits. */
  amount,
}: {
  eligibility: CreditEligibility;
  amount: number;
}) {
  const { t } = useTranslation();
  const overCeiling = amount > eligibility.available;

  return (
    <Card>
      <CardHeader
        title={t('credit.eligibility.title')}
        description={t('credit.eligibility.computedAt', {
          when: formatDateTime(eligibility.computedAt),
        })}
        actions={
          eligibility.eligible ? (
            <Badge tone="success">{t('credit.eligibility.eligible')}</Badge>
          ) : (
            <Badge tone="error">{t('credit.eligibility.notEligible')}</Badge>
          )
        }
      />
      <CardBody className="flex flex-col gap-lg">
        <div className="grid gap-md sm:grid-cols-3">
          <Figure
            label={t('credit.eligibility.ceiling')}
            value={formatAmount(eligibility.ceiling)}
            tone="strong"
          />
          <Figure
            label={t('credit.eligibility.outstanding')}
            value={formatAmount(eligibility.outstanding)}
            tone="muted"
          />
          <Figure
            label={t('credit.eligibility.available')}
            value={formatAmount(eligibility.available)}
          />
        </div>

        {/**
         * The ask, against the headroom. Colour *and* words, because this is the
         * line somebody screenshots into an email when they escalate.
         */}
        <div className="flex flex-wrap items-baseline justify-between gap-sm rounded-md bg-surface-variant px-md py-sm">
          <span className="text-body-small text-text-secondary">{t('credit.requested')}</span>
          <span className="flex items-center gap-sm">
            <span className="numeric text-subtitle font-semibold text-text-primary">
              {formatAmount(amount)}
            </span>
            <Badge tone={overCeiling ? 'error' : 'success'}>
              {overCeiling
                ? t('credit.eligibility.overBy', {
                    amount: formatAmount(amount - eligibility.available),
                  })
                : t('credit.eligibility.withinCeiling')}
            </Badge>
          </span>
        </div>

        {/* Why not, when not — a key from the server, never a sentence composed here. */}
        {eligibility.reasonKey ? (
          <Notice tone="warning">
            <span>
              <strong className="font-semibold">{t('credit.eligibility.blocked')}</strong>{' '}
              {t(eligibility.reasonKey)}
            </span>
          </Notice>
        ) : null}

        <div>
          <h3 className="text-label text-text-primary">{t('credit.eligibility.working')}</h3>
          <dl className="mt-xs divide-y divide-divider">
            <DetailRow
              label={t('credit.eligibility.monthsOfHistory')}
              numeric
              value={
                eligibility.requiredMonths === 0
                  ? // An advance has no history requirement — saying "3 of 0" would
                    // be arithmetic nobody asked for.
                    t('credit.eligibility.historyNotRequired', {
                      count: eligibility.monthsOfHistory,
                    })
                  : t('credit.eligibility.historyOf', {
                      count: eligibility.monthsOfHistory,
                      required: eligibility.requiredMonths,
                    })
              }
            />

            {eligibility.averageMonthlyIncome !== null ? (
              <DetailRow
                label={t('credit.eligibility.averageIncome')}
                numeric
                value={formatAmount(eligibility.averageMonthlyIncome)}
              />
            ) : null}

            {eligibility.limitMultiplier !== null ? (
              <DetailRow
                label={t('credit.eligibility.multiplier')}
                numeric
                value={`× ${eligibility.limitMultiplier}`}
              />
            ) : null}

            {eligibility.lastSettledMonthKey ? (
              <DetailRow
                label={t('credit.eligibility.lastSettledMonth')}
                value={formatMonthKey(eligibility.lastSettledMonthKey)}
              />
            ) : null}

            {/* `null` renders as an em dash, never as LKR 0.00 — the auction result
                simply is not in yet (BR-102). */}
            <DetailRow
              label={t('credit.eligibility.settledRate')}
              numeric
              value={
                eligibility.lastSettledRatePerKg === null
                  ? NOT_AVAILABLE
                  : formatAmount(eligibility.lastSettledRatePerKg)
              }
            />

            {eligibility.pricedKgs !== null ? (
              <DetailRow
                label={t(`credit.eligibility.pricedKgs.${eligibility.facility}`)}
                numeric
                value={formatKg(eligibility.pricedKgs)}
              />
            ) : null}
          </dl>
        </div>
      </CardBody>
    </Card>
  );
}
