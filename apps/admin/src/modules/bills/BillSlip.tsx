/**
 * The bill as a printed slip (24 November 2026): what the office hands a supplier at the
 * counter, and what "Save as PDF" in the print dialog keeps.
 *
 * **Printed by the browser, not made by the server.** There is no admin PDF endpoint, and
 * the browser's print dialog already prints and saves a PDF on every machine the office
 * has. The slip is rendered into `document.body`, outside the console, and only on paper:
 * the print styles hide everything else (`.tfd-print-slip` in `theme.css`), so the screen
 * is never cut off by the console's own scrolling frame.
 *
 * Same figures, same order as the screen and the factory's paper (AC-03): every deduction
 * line, zeros included, and `null` as a dash.
 */

import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { DEDUCTION_CATEGORIES, fullMonthDays, type AdminBill } from '@tfd/domain';
import { useCurrentUser } from '@/auth/authStore';
import {
  formatAmount,
  formatDateTime,
  formatKg,
  formatMoney,
  formatMonthKey,
  formatSignedAmount,
} from '@/lib/format';

export function BillSlip({ bill }: { bill: AdminBill }) {
  return createPortal(<Slip bill={bill} />, document.body);
}

function Slip({ bill }: { bill: AdminBill }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const days = fullMonthDays(bill.monthKey, bill.dailySupply);
  const half = Math.ceil(days.length / 2);

  return (
    <div className="tfd-print-slip" aria-hidden>
      <header className="slip-head">
        <div>
          <p className="slip-factory">{bill.factory.name}</p>
          <p>
            {t('bills.factoryRegNo')}: {bill.factory.regNo}
          </p>
        </div>
        <div className="slip-right">
          <p className="slip-title">{t('bills.detailTitle', { code: bill.supplierCode })}</p>
          <p>{bill.month}</p>
        </div>
      </header>

      <table className="slip-facts">
        <tbody>
          <Row label={t('bills.supplier')} value={`${bill.supplierCode} · ${bill.supplierName}`} />
          <Row label={t('bills.billNo')} value={bill.billNo} />
          <Row label={t('suppliers.detail.payout')} value={t(`suppliers.payment.${bill.paymentMethod}`)} />
          <Row label={t('bills.issued')} value={formatDateTime(bill.billDateTime)} />
        </tbody>
      </table>

      <div className="slip-columns">
        <section>
          <h2>{t('bills.earnings')}</h2>
          <table>
            <tbody>
              <Row label={t('bills.totalKgs')} value={formatKg(bill.totalKgs)} />
              <Row label={t('months.ratePerKg')} value={formatMoney(bill.ratePerKg)} />
              <Row label={t('months.extraRatePerKg')} value={formatMoney(bill.extraRatePerKg)} />
              <Row label={t('months.totalPerKg')} value={formatMoney(bill.totalRatePerKg)} />
              <Row label={t('bills.greenLeafAmount')} value={formatMoney(bill.greenLeafAmount)} />
              <Row label={t('bills.extraPayment')} value={formatMoney(bill.extraPayment)} />
              <Row label={t('bills.grossAmount')} value={formatMoney(bill.grossAmount)} total />
            </tbody>
          </table>

          <h2>{t('bills.balance')}</h2>
          <table>
            <tbody>
              <Row label={t('bills.balanceAmount')} value={formatMoney(bill.balanceAmount)} />
              <Row label={t('bills.coinsBroughtForward')} value={formatAmount(bill.coinsBroughtForward)} />
              {bill.savingsWithdrawal > 0 ? (
                <Row label={t('bills.savingsWithdrawal')} value={formatAmount(bill.savingsWithdrawal)} />
              ) : null}
              {(bill.corrections ?? []).map((line, index) => (
                <Row
                  key={`${line.correctsMonthKey}-${index}`}
                  label={t('bills.correction', { month: formatMonthKey(line.correctsMonthKey) })}
                  value={formatSignedAmount(line.amount)}
                />
              ))}
              <Row label={t('bills.coinsCarriedForward')} value={formatAmount(bill.coinsCarriedForward)} />
              <Row label={t('bills.finalBalance')} value={formatMoney(bill.finalBalance)} total />
            </tbody>
          </table>
        </section>

        <section>
          <h2>{t('bills.deductions')}</h2>
          <table>
            <tbody>
              {DEDUCTION_CATEGORIES.map((category) => (
                <Row
                  key={category}
                  label={
                    category === 'loansAdvance' && bill.loanInstalmentNo
                      ? t('bills.deduction.loanInstalment', { n: bill.loanInstalmentNo })
                      : t(`bills.deduction.${category}`)
                  }
                  value={formatAmount(bill.deductions[category])}
                />
              ))}
              <Row label={t('bills.deductionsTotal')} value={formatMoney(bill.deductions.total)} total />
            </tbody>
          </table>

          <h2>{t('bills.carryForward')}</h2>
          <table>
            <tbody>
              <Row label={t('bills.nextMonthDeb')} value={formatAmount(bill.carryForward.nextMonthDeb)} />
              <Row label={t('bills.loanBalance')} value={formatAmount(bill.carryForward.loanBalance)} />
              <Row label={t('bills.manureBalance')} value={formatAmount(bill.carryForward.manureBalance)} />
              <Row label={t('bills.loanInterest')} value={formatAmount(bill.carryForward.loanInterest)} />
            </tbody>
          </table>

          <h2>{t('suppliers.detail.savings')}</h2>
          <table>
            <tbody>
              <Row label={t('bills.savingsThisMonth')} value={formatAmount(bill.savingsSummary.thisMonth)} />
              <Row label={t('bills.savingsPrevious')} value={formatAmount(bill.savingsSummary.previous)} />
              <Row label={t('bills.savingsToDate')} value={formatMoney(bill.savingsSummary.toDate)} total />
            </tbody>
          </table>
        </section>
      </div>

      <h2>{t('bills.dailySupply')}</h2>
      <table className="slip-days">
        <tbody>
          {[days.slice(0, half), days.slice(half)].map((row, index) => (
            <tr key={index}>
              {row.map((day) => (
                <td key={day.day}>
                  <span className="slip-day">{day.day}</span>
                  <span>{day.kgs === null ? '-' : formatAmount(day.kgs)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="slip-foot">
        {t('bills.printedBy', {
          name: user?.name ?? '',
          when: formatDateTime(new Date().toISOString()),
        })}
      </footer>
    </div>
  );
}

function Row({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <tr className={total ? 'slip-total' : undefined}>
      <th scope="row">{label}</th>
      <td>{value}</td>
    </tr>
  );
}
