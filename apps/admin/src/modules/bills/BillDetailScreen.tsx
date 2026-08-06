/**
 * One Green Leaf Account, laid out as the printed slip.
 *
 * **AC-03 is the whole specification of this screen**: the console, the printed slip
 * and the app's Home screen must be the same figures, field for field. So it does not
 * summarise, re-order or omit — it renders `GreenLeafBill` in the order the paper
 * reads, because the office checks this screen *against* the paper and a rearranged
 * layout makes that comparison line-by-line impossible.
 *
 * Three consequences that look like over-literalism and are not:
 *
 *  - **Every deduction line is shown, including the zeros.** A slip with a blank
 *    where "Stamps" should be is a slip the supplier queries. The nine lines are the
 *    document's shape (§18.1), not a list of non-empty values.
 *  - **The total is verified, not trusted** (BR-107). If the lines disagree with the
 *    stated total, that is said loudly here — this is the last screen before the
 *    figure becomes something a supplier is holding.
 *  - **`null` is an em dash.** A month with no auction result has no gross amount, and
 *    `LKR 0.00` would be a number the office has to explain (BR-102).
 *
 * There is no edit control and there will not be one: a wrong bill is a wrong
 * delivery or a wrong rate, and the fix is upstream in M3 or M4 followed by a
 * re-generation. Whether a *published* bill may be corrected at all is §21.8, still
 * unanswered — see the notice at the foot of the page.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, TriangleAlert } from 'lucide-react';
import { DEDUCTION_CATEGORIES, type AdminBill } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Spinner } from '@/components/ui/states';
import { formatAmount, formatDateTime, formatKg, formatMoney, formatMonthKey } from '@/lib/format';
import { billIsBalanced } from '@/services/repositories/billRepository';
import { useBill } from './hooks';

export function BillDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const bill = useBill(id);

  if (bill.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (bill.error || !bill.data) {
    return <ErrorState error={bill.error} onRetry={() => void bill.refetch()} />;
  }

  const data = bill.data;
  const balanced = billIsBalanced(data);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to={`/bills?month=${data.monthKey}`}
            className="inline-flex items-center gap-xxs text-primary underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-icon-xs" aria-hidden />
            {t('bills.backToMonth', { month: formatMonthKey(data.monthKey) })}
          </Link>
        }
        title={t('bills.detailTitle', { code: data.supplierCode })}
        description={t('bills.detailSubtitle', { name: data.supplierName, month: data.month })}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            <Figure label={t('bills.column.payable')} value={formatMoney(data.finalBalance)} strong />
            <Badge tone={data.publishedAt ? 'success' : 'info'}>
              {data.publishedAt ? t('bills.published') : t('bills.draft')}
            </Badge>
          </div>
        }
      />

      {/* BR-107, said loudly. This is the last screen before the figure is a document
          somebody is holding. */}
      {!balanced ? (
        <p
          role="alert"
          className="flex items-start gap-xs rounded-md bg-error-muted px-lg py-sm text-body-small text-error"
        >
          <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          {t('bills.unbalancedWarning')}
        </p>
      ) : null}

      <div className="grid gap-lg lg:grid-cols-2">
        {/* ── Who and what ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader title={t('bills.slipHeader')} description={data.factory.name} />
          <CardBody>
            <dl>
              <DetailRow label={t('bills.billNo')} value={data.billNo} numeric />
              <DetailRow label={t('bills.month')} value={data.month} />
              <DetailRow
                label={t('bills.supplier')}
                value={`${data.supplierCode} · ${data.supplierName}`}
              />
              <DetailRow
                label={t('suppliers.detail.payout')}
                value={t(`suppliers.payment.${data.paymentMethod}`)}
              />
              <DetailRow label={t('bills.issued')} value={formatDateTime(data.billDateTime)} />
              <DetailRow
                label={t('bills.factoryRegNo')}
                value={data.factory.regNo}
                numeric
              />
            </dl>
          </CardBody>
        </Card>

        {/* ── What the leaf was worth ────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={t('bills.earnings')}
            description={
              data.auctionResultAvailable ? undefined : t('bills.noAuctionResult')
            }
          />
          <CardBody>
            <dl>
              <DetailRow label={t('bills.totalKgs')} value={formatKg(data.totalKgs)} numeric />
              <DetailRow label={t('months.ratePerKg')} value={formatMoney(data.ratePerKg)} numeric />
              <DetailRow
                label={t('months.extraRatePerKg')}
                value={formatMoney(data.extraRatePerKg)}
                numeric
              />
              <DetailRow
                label={t('months.totalPerKg')}
                value={formatMoney(data.totalRatePerKg)}
                numeric
              />
              <div className="mt-xs border-t border-divider pt-xs">
                <dl>
                  <DetailRow
                    label={t('bills.greenLeafAmount')}
                    value={formatMoney(data.greenLeafAmount)}
                    numeric
                  />
                  <DetailRow
                    label={t('bills.extraPayment')}
                    value={formatMoney(data.extraPayment)}
                    numeric
                  />
                  <DetailRow
                    label={<span className="font-semibold">{t('bills.grossAmount')}</span>}
                    value={
                      <span className="font-semibold">{formatMoney(data.grossAmount)}</span>
                    }
                    numeric
                  />
                </dl>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* ── The nine lines ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader title={t('bills.deductions')} description={t('bills.deductionsPolicy')} />
          <CardBody>
            <dl>
              {/* Iterated from the shared constant, in slip order, zeros included:
                  the nine lines are the document's shape, not a list of non-empty
                  values, and a missing row is a row the supplier asks about. */}
              {DEDUCTION_CATEGORIES.map((category) => (
                <DetailRow
                  key={category}
                  label={t(`bills.deduction.${category}`)}
                  value={formatAmount(data.deductions[category])}
                  numeric
                />
              ))}
              <div className="mt-xs border-t border-divider pt-xs">
                <DetailRow
                  label={<span className="font-semibold">{t('bills.deductionsTotal')}</span>}
                  value={
                    <span className={balanced ? 'font-semibold' : 'font-semibold text-error'}>
                      {formatMoney(data.deductions.total)}
                    </span>
                  }
                  numeric
                />
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* ── What is actually paid ──────────────────────────────────────── */}
        <Card>
          <CardHeader title={t('bills.balance')} description={t('bills.balanceDescription')} />
          <CardBody>
            <dl>
              <DetailRow
                label={t('bills.balanceAmount')}
                value={formatMoney(data.balanceAmount)}
                numeric
              />
              <DetailRow
                label={t('bills.coinsBroughtForward')}
                value={formatAmount(data.coinsBroughtForward)}
                numeric
              />
              {/**
               * Savings taken back (§21.9), shown **only when there is one**.
               *
               * The one row on this slip that is conditional, and deliberately so: a zero
               * here every month would read as "your savings were touched and came to
               * nothing", which is the opposite of what happened. The nine deduction lines
               * above print their zeros because their absence would look like an omission
               * from a document the supplier checks line by line; this is not one of them.
               */}
              {data.savingsWithdrawal > 0 ? (
                <DetailRow
                  label={t('bills.savingsWithdrawal')}
                  value={formatAmount(data.savingsWithdrawal)}
                  numeric
                />
              ) : null}
              <DetailRow
                label={t('bills.coinsCarriedForward')}
                value={formatAmount(data.coinsCarriedForward)}
                numeric
              />
              <div className="mt-xs border-t border-divider pt-xs">
                <DetailRow
                  label={<span className="font-semibold">{t('bills.finalBalance')}</span>}
                  value={
                    <span className="text-subtitle font-semibold">
                      {formatMoney(data.finalBalance)}
                    </span>
                  }
                  numeric
                />
              </div>
            </dl>

            {/* An account that owes more than it earned pays nothing, and the reader
                needs to be told that rather than left to infer it from a zero. */}
            {data.carryForward.nextMonthDeb > 0 ? (
              <p className="mt-sm rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
                {t('bills.carriesDebtNotice', {
                  amount: formatMoney(data.carryForward.nextMonthDeb),
                })}
              </p>
            ) : null}

            {(data.finalBalance ?? 0) > 0 && !data.hasBankDetails ? (
              <p className="mt-sm rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
                {t('bills.noBankNotice')}
              </p>
            ) : null}
          </CardBody>
        </Card>

        {/* ── Carried into next month ────────────────────────────────────── */}
        <Card>
          <CardHeader title={t('bills.carryForward')} />
          <CardBody>
            <dl>
              <DetailRow
                label={t('bills.nextMonthDeb')}
                value={formatAmount(data.carryForward.nextMonthDeb)}
                numeric
              />
              {/* Slip wording: this line is the **advance** balance (§9.4). Renamed
                  in the label rather than in the payload, because the payload is the
                  app's and the app prints the slip's word. */}
              <DetailRow
                label={t('bills.advanceBalance')}
                value={formatAmount(data.carryForward.loanBalance)}
                numeric
              />
              <DetailRow
                label={t('bills.manureBalance')}
                value={formatAmount(data.carryForward.manureBalance)}
                numeric
              />
              <DetailRow
                label={t('bills.loanInterest')}
                value={formatAmount(data.carryForward.loanInterest)}
                numeric
              />
            </dl>
          </CardBody>
        </Card>

        {/* ── Savings ────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={t('suppliers.detail.savings')}
            description={t('bills.savingsDescription')}
            actions={
              <Link
                to={`/savings?supplier=${data.supplierId}`}
                className="text-label text-primary underline-offset-2 hover:underline"
              >
                {t('bills.openPassbook')}
              </Link>
            }
          />
          <CardBody>
            <dl>
              <DetailRow
                label={t('bills.savingsThisMonth')}
                value={formatAmount(data.savingsSummary.thisMonth)}
                numeric
              />
              <DetailRow
                label={t('bills.savingsPrevious')}
                value={formatAmount(data.savingsSummary.previous)}
                numeric
              />
              <DetailRow
                label={<span className="font-semibold">{t('bills.savingsToDate')}</span>}
                value={
                  <span className="font-semibold">{formatMoney(data.savingsSummary.toDate)}</span>
                }
                numeric
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      <DailySupplyCard bill={data} />

      {/* §21.8 stated on the screen it affects, rather than only in the docs: an
          office that does not know a published bill is final will ask for an edit
          button, and the honest answer is that nobody has decided yet. */}
      <p className="flex items-start gap-xs rounded-md bg-surface-variant px-lg py-sm text-body-small text-text-secondary">
        <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
        {data.publishedAt ? t('bills.correctionsPublished') : t('bills.correctionsDraft')}
      </p>
    </>
  );
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

/**
 * The day grid the slip prints.
 *
 * Kept as a grid rather than a list of the days with leaf on them, because the office
 * reads it as a calendar: "did they come in on the 14th" is answered by looking at the
 * 14th, and a compacted list makes that a search.
 */
function DailySupplyCard({ bill }: { bill: AdminBill }) {
  const { t } = useTranslation();
  const days = bill.dailySupply.filter((day) => day.kgs !== null).length;

  return (
    <Card>
      <CardHeader
        title={t('bills.dailySupply')}
        description={t('bills.dailySupplyDetail', {
          days,
          kgs: formatKg(bill.totalKgs),
        })}
      />
      <CardBody>
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-xs">
          {bill.dailySupply.map((day) => (
            <li
              key={day.day}
              className={
                day.kgs === null
                  ? 'flex flex-col rounded-sm bg-surface-variant px-xs py-xxs text-caption text-text-secondary'
                  : 'flex flex-col rounded-sm bg-primary-muted px-xs py-xxs text-caption text-text-primary'
              }
            >
              <span className="numeric text-text-secondary">{day.day}</span>
              {/* A day with no leaf shows an em dash, not `0.00`: the supplier did
                  not come in, which is not the same as bringing nothing. */}
              <span className="numeric font-medium">
                {day.kgs === null ? '—' : formatAmount(day.kgs)}
              </span>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
