/**
 * One Green Leaf Account, laid out as the printed slip.
 *
 * **AC-03 is the whole specification of this screen**: the console, the printed slip
 * and the app's Home screen must be the same figures, field for field. So the cards do
 * not summarise, re-order or omit; they render `GreenLeafBill` in the order the paper
 * reads, because the office checks this screen *against* the paper and a rearranged
 * layout makes that comparison line-by-line impossible.
 *
 * Three consequences that look like over-literalism and are not:
 *
 *  - **Every deduction line is shown, including the zeros.** A slip with a blank
 *    where "Stamps" should be is a slip the supplier queries. The nine lines are the
 *    document's shape (§18.1), not a list of non-empty values. A zero is drawn quieter
 *    (24 November 2026), so the lines that took money stand out, but it is still there.
 *  - **The total is verified, not trusted** (BR-107). If the lines disagree with the
 *    stated total, that is said loudly here: this is the last screen before the
 *    figure becomes something a supplier is holding.
 *  - **`null` is a dash (`-`).** A month with no auction result has no gross amount, and
 *    `LKR 0.00` would be a number the office has to explain (BR-102).
 *
 * The strip above the cards (24 November 2026) repeats four of the slip's own totals so
 * the account reads at a glance; it adds nothing the cards do not carry and takes nothing
 * out of them.
 *
 * There is no edit control and there will not be one: a wrong bill is a wrong
 * delivery or a wrong rate, and the fix is upstream in M3 or M4 followed by a
 * re-generation. Whether a *published* bill may be corrected at all is §21.8, still
 * unanswered. See the notice at the foot of the page.
 */

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Printer, TriangleAlert } from 'lucide-react';
import { DEDUCTION_CATEGORIES, collectionPointDays, fullMonthDays, type AdminBill } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { InfoTip } from '@/components/ui/Tooltip';
import { ErrorState, PageSkeleton } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import {
  formatAmount,
  formatDateTime,
  formatKg,
  formatMoney,
  formatMonthKey,
  formatPercent,
  formatSignedAmount,
} from '@/lib/format';
import { billIsBalanced } from '@/services/repositories/billRepository';
import { useBill } from './hooks';
import { useCan } from '@/auth/authStore';
import { useKeepsFactoryRecords } from '@/config/RuntimeConfigProvider';
import { OtherChargesDialog } from './OtherChargesDialog';
import { BillSlip } from './BillSlip';
import { OTHER_DEDUCTIONS_ON_SERVER } from '@/lib/serverReady';
import { InlineLink } from '@/components/ui/InlineLink';

export function BillDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const bill = useBill(id);
  const keepsRecords = useKeepsFactoryRecords();
  const canWriteBills = useCan('billing', 'write');
  const [adjusting, setAdjusting] = useState(false);

  if (bill.isPending) {
    return (
      <PageSkeleton />
    );
  }
  if (bill.error || !bill.data) {
    return <ErrorState error={bill.error} onRetry={() => void bill.refetch()} />;
  }

  const data = bill.data;
  const balanced = billIsBalanced(data);
  // An imported bill is the factory's own figures: corrected in their system and re-imported.
  const canAdjust =
    OTHER_DEDUCTIONS_ON_SERVER &&
    keepsRecords &&
    canWriteBills &&
    data.publishedAt === null &&
    data.source !== 'imported';
  const leafDays = data.dailySupply.filter((day) => day.kgs !== null).length;
  const deductionShare =
    data.grossAmount && data.grossAmount > 0 ? data.deductions.total / data.grossAmount : null;

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
          <div className="flex flex-wrap items-center gap-xs">
            {data.source === 'imported' ? (
              <Badge tone="neutral">{t('records.bills.imported')}</Badge>
            ) : null}
            {data.heldAt ? <Badge tone="warning">{t('slips.status.held')}</Badge> : null}
            <Badge tone={data.publishedAt ? 'success' : 'info'}>
              {data.publishedAt ? t('bills.published') : t('bills.draft')}
            </Badge>
            {/* The slip on paper, or kept as a PDF from the print dialog (24 November 2026). */}
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Printer className="size-icon-sm" aria-hidden />}
              onClick={() => window.print()}
            >
              {t('bills.print')}
            </Button>
          </div>
        }
      />

      {/* Held back from the publish until it agrees with the factory's printed slip. */}
      {data.heldAt && data.heldForMonth ? (
        <p className="flex shrink-0 flex-wrap items-center gap-x-md gap-y-xxs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
          {t('slips.heldForEarlierNotice', { month: formatMonthKey(data.heldForMonth) })}
          {/* The month whose held bill this one waits on. */}
          <InlineLink to={`/bills?month=${data.heldForMonth}`}>{t('link.openBills')}</InlineLink>
        </p>
      ) : data.heldAt ? (
        <p className="shrink-0 rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
          {t('slips.heldNotice', {
            name: data.heldByName ?? '',
            reason: data.holdReason ?? '',
            printed:
              data.printedFinalBalance === null || data.printedFinalBalance === undefined
                ? '-'
                : formatMoney(data.printedFinalBalance),
          })}
        </p>
      ) : null}

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

      {/* ── At a glance: the slip's own totals, in the order they are reached ── */}
      <dl aria-label={t('bills.atAGlance')} className="grid shrink-0 grid-cols-2 gap-md lg:grid-cols-4">
        <GlanceTile
          label={t('bills.totalKgs')}
          value={formatKg(data.totalKgs)}
          note={t('bills.leafDays', { count: leafDays })}
        />
        <GlanceTile
          label={t('bills.grossAmount')}
          value={formatMoney(data.grossAmount)}
          note={
            data.auctionResultAvailable
              ? t('bills.perKg', { rate: formatMoney(data.totalRatePerKg) })
              : t('bills.noAuctionResult')
          }
        />
        <GlanceTile
          label={t('bills.deductionsTotal')}
          value={formatMoney(data.deductions.total)}
          note={
            deductionShare === null
              ? undefined
              : t('bills.shareOfGross', { percent: formatPercent(deductionShare) })
          }
          tone={balanced ? undefined : 'error'}
        />
        <GlanceTile
          label={t('bills.payable')}
          value={formatMoney(data.finalBalance)}
          note={t(`suppliers.payment.${data.paymentMethod}`)}
          tone="primary"
        />
      </dl>

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
                value={
                  <InlineLink to={`/suppliers/${data.supplierId}`} arrow={false} className="text-primary">
                    {`${data.supplierCode} · ${data.supplierName}`}
                  </InlineLink>
                }
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
            </dl>
            {/* A second list rather than a wrapper inside the first: a `dl` holds only
                its rows. */}
            <dl className="mt-xs border-t border-divider pt-xs">
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
              <TotalRow label={t('bills.grossAmount')} value={formatMoney(data.grossAmount)} />
            </dl>
          </CardBody>
        </Card>

        {/* ── The nine lines ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={<TitleWithTip title={t('bills.deductions')} tip={t('bills.deductionsPolicy')} />}
          />
          <CardBody>
            <dl>
              {/* Iterated from the shared constant, in slip order, zeros included:
                  the nine lines are the document's shape, not a list of non-empty
                  values, and a missing row is a row the supplier asks about. */}
              {DEDUCTION_CATEGORIES.map((category) =>
                category === 'otherCards' ? (
                  <DetailRow
                    key={category}
                    label={
                      // The note goes under the name, inside the row: a `dl` holds only rows.
                      <span className="flex flex-col">
                        <span className="flex items-center gap-xs">
                          {t(`bills.deduction.${category}`)}
                          {/* The one typed line, and only on a bill this console calculated
                              and the supplier cannot see yet. */}
                          {canAdjust ? (
                            <button
                              type="button"
                              onClick={() => setAdjusting(true)}
                              className="rounded-sm px-xs text-caption font-medium text-primary hover:bg-primary-muted"
                            >
                              {t('records.otherCharges.edit')}
                            </button>
                          ) : null}
                        </span>
                        {data.otherCardsNote ? (
                          <span className="text-caption">{data.otherCardsNote}</span>
                        ) : null}
                      </span>
                    }
                    value={<Amount value={data.deductions[category]} />}
                    numeric
                  />
                ) : (
                  <DetailRow
                    key={category}
                    label={
                      // The slip's "Loans / Advance 3": which instalment of the loan this is.
                      category === 'loansAdvance' && data.loanInstalmentNo
                        ? t('bills.deduction.loanInstalment', { n: data.loanInstalmentNo })
                        : t(`bills.deduction.${category}`)
                    }
                    value={<Amount value={data.deductions[category]} />}
                    numeric
                  />
                ),
              )}
              <TotalRow
                label={t('bills.deductionsTotal')}
                value={formatMoney(data.deductions.total)}
                tone={balanced ? undefined : 'error'}
              />
            </dl>
          </CardBody>
        </Card>

        {/* Balance and what carries over share the column beside the nine lines, so
            neither card stretches to the deductions' height with nothing in it. */}
        <div className="flex flex-col gap-lg">
          {/* ── What is actually paid ──────────────────────────────────────── */}
          <Card>
            <CardHeader
              title={<TitleWithTip title={t('bills.balance')} tip={t('bills.balanceDescription')} />}
            />
            <CardBody>
              <dl>
                <DetailRow
                  label={t('bills.balanceAmount')}
                  value={formatMoney(data.balanceAmount)}
                  numeric
                />
                <DetailRow
                  label={t('bills.coinsBroughtForward')}
                  value={<Amount value={data.coinsBroughtForward} />}
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
                {/* C5: an earlier month paid too little (+) or too much (-), with the reason. */}
                {(data.corrections ?? []).map((line, index) => (
                  <DetailRow
                    key={`${line.correctsMonthKey}-${index}`}
                    label={
                      <span className="flex flex-col">
                        {t('bills.correction', { month: formatMonthKey(line.correctsMonthKey) })}
                        <span className="text-caption">{line.reason}</span>
                      </span>
                    }
                    value={formatSignedAmount(line.amount)}
                    numeric
                  />
                ))}
                <DetailRow
                  label={t('bills.coinsCarriedForward')}
                  value={<Amount value={data.coinsCarriedForward} />}
                  numeric
                />
                <TotalRow
                  label={t('bills.finalBalance')}
                  value={formatMoney(data.finalBalance)}
                  tone="primary"
                />
              </dl>

              {/* An account that owes more than it earned pays nothing, and the reader
                  needs to be told that rather than left to infer it from a zero. */}
              {data.carryForward.nextMonthDeb > 0 ? (
                <p className="mt-sm flex flex-wrap items-center gap-x-md gap-y-xxs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
                  {t('bills.carriesDebtNotice', {
                    amount: formatMoney(data.carryForward.nextMonthDeb),
                  })}
                  <InlineLink to={`/suppliers/${data.supplierId}?tab=money`}>{t('link.openPayout')}</InlineLink>
                </p>
              ) : null}

              {(data.finalBalance ?? 0) > 0 && !data.hasBankDetails ? (
                <p className="mt-sm flex flex-wrap items-center gap-x-md gap-y-xxs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
                  {t('bills.noBankNotice')}
                  <InlineLink to={`/suppliers/${data.supplierId}?tab=money`}>{t('link.openPayout')}</InlineLink>
                </p>
              ) : null}
            </CardBody>
          </Card>

          {/* ── Carried into next month ────────────────────────────────────── */}
          <Card className="flex-1">
            <CardHeader title={t('bills.carryForward')} />
            <CardBody>
              <dl>
                <DetailRow
                  label={t('bills.nextMonthDeb')}
                  value={<Amount value={data.carryForward.nextMonthDeb} />}
                  numeric
                />
                {/* The slip's "Loan Balance": the loan still owed. An advance is settled
                    within its month, so it never carries. */}
                <DetailRow
                  label={t('bills.loanBalance')}
                  value={<Amount value={data.carryForward.loanBalance} />}
                  numeric
                />
                <DetailRow
                  label={t('bills.manureBalance')}
                  value={<Amount value={data.carryForward.manureBalance} />}
                  numeric
                />
                <DetailRow
                  label={t('bills.loanInterest')}
                  value={<Amount value={data.carryForward.loanInterest} />}
                  numeric
                />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── Savings: three figures, read across ─────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <TitleWithTip title={t('suppliers.detail.savings')} tip={t('bills.savingsDescription')} />
          }
          actions={
            <Link
              // The supplier's own savings card and ledger. It pointed at `/savings`, which
              // is not a route, and every click landed on the dashboard (27 November 2026).
              to={`/suppliers/${data.supplierId}?tab=money`}
              className="text-label text-primary underline-offset-2 hover:underline"
            >
              {t('bills.openPassbook')}
            </Link>
          }
        />
        <CardBody>
          <dl className="grid gap-md sm:grid-cols-3">
            <SavingsFigure label={t('bills.savingsThisMonth')} value={formatAmount(data.savingsSummary.thisMonth)} />
            <SavingsFigure label={t('bills.savingsPrevious')} value={formatAmount(data.savingsSummary.previous)} />
            <SavingsFigure
              label={t('bills.savingsToDate')}
              value={formatMoney(data.savingsSummary.toDate)}
              strong
            />
          </dl>
        </CardBody>
      </Card>

      <DailySupplyCard bill={data} />

      {/* §21.8 stated on the screen it affects, rather than only in the docs: an
          office that does not know a published bill is final will ask for an edit
          button, and the honest answer is that nobody has decided yet. */}
      <p className="flex items-start gap-xs rounded-md bg-surface-variant px-lg py-sm text-body-small text-text-secondary">
        <Lock className="mt-xxs size-icon-sm shrink-0" aria-hidden />
        {data.publishedAt ? t('bills.correctionsPublished') : t('bills.correctionsDraft')}
      </p>
      <BillSlip bill={data} />
      {adjusting ? (
        <OtherChargesDialog
          billId={data.id}
          amount={data.deductions.otherCards}
          note={data.otherCardsNote}
          onClose={() => setAdjusting(false)}
        />
      ) : null}
    </>
  );
}

/** One of the four totals in the strip above the cards. */
function GlanceTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'primary' | 'error';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-xxs rounded-lg border p-lg shadow-card',
        tone === 'primary' ? 'border-primary bg-primary-muted' : 'border-border bg-surface',
      )}
    >
      <dt className="text-caption font-medium text-text-secondary">{label}</dt>
      <dd
        className={cn(
          'numeric text-h3 font-semibold tracking-tight',
          tone === 'error' ? 'text-error' : 'text-text-primary',
        )}
      >
        {value}
      </dd>
      {note ? <dd className="text-caption text-text-secondary">{note}</dd> : null}
    </div>
  );
}

/**
 * A slip line's amount. A zero is still printed (the line is the document's shape), only
 * quieter, so the lines that moved money are the ones the eye lands on.
 */
function Amount({ value }: { value: number | null }) {
  return (
    <span className={value === 0 ? 'text-text-secondary' : 'font-medium'}>{formatAmount(value)}</span>
  );
}

/** A card's subtotal, on a band of its own so it is never read as one more line. */
function TotalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'error';
}) {
  return (
    <div
      className={cn(
        'mt-sm flex flex-wrap items-baseline justify-between gap-sm rounded-md px-sm py-xs',
        tone === 'primary' ? 'bg-primary-muted' : 'bg-surface-variant',
      )}
    >
      <dt className="text-body-small font-semibold text-text-primary">{label}</dt>
      <dd
        className={cn(
          'numeric font-semibold',
          tone === 'primary' ? 'text-subtitle text-text-primary' : 'text-body-small',
          tone === 'error' ? 'text-error' : 'text-text-primary',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SavingsFigure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-xxs rounded-md px-md py-sm', strong ? 'bg-primary-muted' : 'bg-surface-variant')}>
      <dt className="text-caption text-text-secondary">{label}</dt>
      <dd className="numeric text-subtitle font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

/** A card title with its explanation behind an "i" (24 November 2026). */
function TitleWithTip({ title, tip }: { title: string; tip: ReactNode }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-xxs">
      {title}
      <InfoTip label={`${t('tip.moreInfo')}: ${title}`}>{tip}</InfoTip>
    </span>
  );
}

/**
 * The day grid the slip prints.
 *
 * Kept as a grid rather than a list of the days with leaf on them, because the office
 * reads it as a calendar: "did they come in on the 14th" is answered by looking at the
 * 14th, and a compacted list makes that a search. A bar under each figure (24 November
 * 2026) shows the day against the month's heaviest, so a thin week shows without reading.
 */
function DailySupplyCard({ bill }: { bill: AdminBill }) {
  const { t } = useTranslation();
  const days = bill.dailySupply.filter((day) => day.kgs !== null).length;
  const points = collectionPointDays(bill.dailySupply);
  const heaviest = Math.max(0, ...bill.dailySupply.map((day) => day.kgs ?? 0));

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
          {/* The bill sends only the days with leaf: drawn as the whole month. */}
          {fullMonthDays(bill.monthKey, bill.dailySupply).map((day) => (
            <li
              key={day.day}
              // The point(s) the day's leaf went in at, on hover (Q13).
              title={day.points?.length ? day.points.join(', ') : undefined}
              className={cn(
                'flex flex-col gap-xxs rounded-md border px-sm py-xs text-caption',
                day.kgs === null
                  ? 'border-transparent bg-surface-variant text-text-secondary'
                  : 'border-primary/30 bg-primary-muted text-text-primary',
              )}
            >
              <span className="numeric text-text-secondary">{day.day}</span>
              {/* A day with no leaf shows a dash (`-`), not `0.00`: the supplier did
                  not come in, which is not the same as bringing nothing. */}
              <span className="numeric text-body-small font-semibold">
                {day.kgs === null ? '-' : formatAmount(day.kgs)}
              </span>
              {/* Always the same height, so a day with no leaf keeps its row in line. */}
              <span
                aria-hidden
                className={cn('h-1 overflow-clip rounded-full', day.kgs === null ? '' : 'bg-surface')}
              >
                {day.kgs !== null && heaviest > 0 ? (
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(6, (day.kgs / heaviest) * 100)}%` }}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ol>
        {/* Where the month's leaf went in (Q13), when the source says. */}
        {points.length > 0 ? (
          <p className="mt-sm text-body-small text-text-secondary">
            {t('bills.weighedAt', {
              points: points.map((one) => t('bills.pointDays', { point: one.point, count: one.days })).join(', '),
            })}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
