/**
 * M4 Rates & month close.
 *
 * The gate every other money module reads. §13's cycle stage decides what M3 will
 * accept, what a bill can be built from, and whether a payout run may exist at all
 * — so this screen's job is to make the month's state, and what is blocking it,
 * impossible to misread.
 *
 * Laid out as three answers to three questions, in the order the office asks them:
 *
 *  1. **Where is this month?** — the stage badge and the month picker.
 *  2. **What is it worth?** — the rate card, which is also where the rate is entered.
 *  3. **What is stopping the close?** — the checklist, then the exception queue it
 *     counts, which is the list the accountant actually works.
 *
 * The month lives in the URL, so "look at June" is a link, and a month that has
 * been published looks different rather than merely having disabled buttons.
 */

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { MonthSummary } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Field';
import { ErrorState, Spinner } from '@/components/ui/states';
import { formatCount, formatKg, formatMonthKey } from '@/lib/format';
import { CloseChecklist } from './CloseChecklist';
import { ExceptionsQueue } from './ExceptionsQueue';
import { RateCard } from './RateCard';
import { useMonth, useMonths } from './hooks';

export function MonthCloseScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const months = useMonths();
  /**
   * The month in progress is the default, and it comes from the server's list
   * rather than from `new Date()`: the factory's calendar month is the one the API
   * says is open, and a browser in another timezone must not pick a different one.
   */
  const known = months.data?.items ?? [];
  const fallback = known[0]?.monthKey;
  const requested = params.get('month');
  /**
   * The URL is checked against the months the API returned, not trusted.
   *
   * A stale bookmark, a typo, or a key pasted from somewhere else would otherwise
   * be sent to the server as a month — and a screen that renders whatever comes
   * back is a screen that can show a month the factory has no records for.
   */
  const monthKey =
    requested && known.some((item) => item.monthKey === requested)
      ? requested
      : (fallback ?? '');

  const month = useMonth(monthKey);

  if (months.error) return <ErrorState error={months.error} onRetry={() => void months.refetch()} />;
  if (!monthKey || month.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (month.error || !month.data) {
    return <ErrorState error={month.error} onRetry={() => void month.refetch()} />;
  }

  const current = month.data;

  return (
    <>
      <PageHeader
        title={t('months.title')}
        description={t('months.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            <Figure label={t('months.totalKgs')} value={formatKg(current.totalKgs)} strong />
            <Figure label={t('months.suppliers')} value={formatCount(current.supplierCount)} />
            <StageBadge month={current} />
            <label className="flex flex-col gap-xs text-label text-text-primary">
              <span className="sr-only">{t('months.pickMonth')}</span>
              <Select
                aria-label={t('months.pickMonth')}
                value={monthKey}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  next.set('month', event.target.value);
                  setParams(next, { replace: true });
                }}
                fullWidth={false}
              >
                {(months.data?.items ?? []).map((item) => (
                  <option key={item.monthKey} value={item.monthKey}>
                    {formatMonthKey(item.monthKey)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        }
      />

      {/* Rate and checklist side by side on a laptop: the accountant enters the
          rate and immediately sees which step it unblocked. */}
      <div className="grid shrink-0 gap-lg lg:grid-cols-2">
        <RateCard month={current} />
        <CloseChecklist month={current} />
      </div>

      <ExceptionsQueue month={current} />
    </>
  );
}

function StageBadge({ month }: { month: MonthSummary }) {
  const { t } = useTranslation();
  const tone = !month.open ? 'success' : month.openExceptions > 0 ? 'warning' : 'info';
  return <Badge tone={tone}>{t(`month.stage.${month.stage}`)}</Badge>;
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-caption text-text-secondary">{label}</span>
      <span
        className={
          strong ? 'numeric text-h3 text-text-primary' : 'numeric text-subtitle text-text-primary'
        }
      >
        {value}
      </span>
    </div>
  );
}
