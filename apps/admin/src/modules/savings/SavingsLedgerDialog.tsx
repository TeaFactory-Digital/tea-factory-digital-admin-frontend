/**
 * One supplier's passbook.
 *
 * **Oldest first, with a running balance** — the order is the whole reason this is a
 * ledger rather than a list of amounts. A passbook is read forward, and reversing it
 * would put the closing figure at the top with nothing above it to explain how it got
 * there, which is exactly the question a supplier brings to the counter.
 *
 * Every row says where it came from. A contribution is a `savings` deduction on a
 * published bill and links back to that bill, because "which month is this from" is
 * the second question after "what is my balance".
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { SavingsAccount } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { formatAmount, formatMoney, formatMonthKey } from '@/lib/format';
import { useSavingsLedger } from './hooks';

export function SavingsLedgerDialog({
  account,
  onClose,
}: {
  account: SavingsAccount | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ledger = useSavingsLedger(account?.supplierId);

  const rows = ledger.data?.items ?? [];

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="md"
      title={
        account
          ? t('savings.ledgerTitle', { code: account.supplierCode, name: account.supplierName })
          : ''
      }
      description={
        account
          ? t('savings.ledgerSubtitle', {
              balance: formatMoney(account.balance),
              rate: formatMoney(account.savingsPerKg),
            })
          : undefined
      }
      footer={
        <>
          {account ? (
            <Link
              to={`/suppliers/${account.supplierId}`}
              className="mr-auto text-label text-primary underline-offset-2 hover:underline"
            >
              {t('changeRequests.detail.supplierLink')}
            </Link>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </>
      }
    >
      {ledger.isPending ? (
        <div className="flex justify-center py-lg">
          <Spinner />
        </div>
      ) : ledger.error ? (
        <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} compact />
      ) : rows.length === 0 ? (
        <EmptyState title={t('savings.noLedger')} body={t('savings.noLedgerHint')} />
      ) : (
        <div className="max-h-96 overflow-auto">
          {/* A real table: the office pastes this into a spreadsheet, which is where
              the office lives (§19.5). */}
          <table className="w-full border-collapse text-data-cell" aria-label={t('savings.ledgerTable')}>
            <thead className="sticky top-0 bg-table-header shadow-[inset_0_-1px_0_0_var(--color-border)]">
              <tr>
                <th scope="col" className="px-sm py-xs text-left text-data-header uppercase text-text-secondary">
                  {t('savings.column.month')}
                </th>
                <th scope="col" className="px-sm py-xs text-left text-data-header uppercase text-text-secondary">
                  {t('savings.column.source')}
                </th>
                <th scope="col" className="px-sm py-xs text-right text-data-header uppercase text-text-secondary">
                  {t('savings.column.amount')}
                </th>
                <th scope="col" className="px-sm py-xs text-right text-data-header uppercase text-text-secondary">
                  {t('savings.column.balance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={index % 2 === 1 ? 'border-b border-divider bg-table-row-alt' : 'border-b border-divider'}
                >
                  <td className="px-sm py-xs whitespace-nowrap">
                    {entry.billId ? (
                      <Link
                        to={`/bills/${entry.billId}`}
                        className="numeric text-primary underline-offset-2 hover:underline"
                      >
                        {formatMonthKey(entry.monthKey)}
                      </Link>
                    ) : (
                      <span className="numeric text-text-primary">
                        {formatMonthKey(entry.monthKey)}
                      </span>
                    )}
                  </td>
                  <td className="px-sm py-xs">
                    <Badge tone={entry.source === 'billDeduction' ? 'neutral' : 'info'}>
                      {t(`savings.source.${entry.source}`)}
                    </Badge>
                  </td>
                  <td className="numeric px-sm py-xs text-right text-text-primary">
                    {formatAmount(entry.amount)}
                  </td>
                  <td className="numeric px-sm py-xs text-right font-semibold text-text-primary">
                    {formatAmount(entry.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/**
           * §21.9, stated where somebody would look for the control.
           *
           * The office will ask where the withdrawal button is, and the honest answer
           * is that whether a supplier may withdraw at all — on what notice, and
           * whether interest is paid — has not been decided. A button built on a guess
           * would move somebody's savings on a rule nobody approved.
           */}
          <p className="mt-md rounded-md bg-surface-variant px-md py-sm text-caption text-text-secondary">
            {t('savings.withdrawalsPending')}
          </p>
        </div>
      )}
    </Dialog>
  );
}
