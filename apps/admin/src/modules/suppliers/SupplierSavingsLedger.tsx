/**
 * One supplier's savings passbook: every line in and out, with the balance after each.
 *
 * **Read only, on purpose.** Savings belong to the factory's own system; this console
 * shows a copy (factory-integration-spec §1.1). So there is no withdrawal button here:
 * a withdrawal is recorded where the money is, and arrives in this passbook from there.
 *
 * Newest first, because the office opens this to answer "what happened last month".
 * The balance on each line is the balance *after* that line, so it reads correctly in
 * either order.
 *
 * Hidden entirely for a factory that does not run a savings scheme: the API answers
 * `403 feature-disabled`, which is a fact about the factory, not an error to show.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, PiggyBank } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatMoney, formatMonthKey } from '@/lib/format';
import { isApiError } from '@/services/api/errors';
import { useSupplierSavingsLedger } from './hooks';

const KNOWN_SOURCES = ['openingBalance', 'billDeduction', 'adjustment', 'withdrawal', 'interest'];

export function SupplierSavingsLedger({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();
  const query = useSupplierSavingsLedger(supplierId);

  const lines = useMemo(() => [...(query.data ?? [])].reverse(), [query.data]);
  const totals = useMemo(() => {
    const all = query.data ?? [];
    return {
      paidIn: all.filter((l) => l.amount > 0).reduce((sum, l) => sum + l.amount, 0),
      takenOut: all.filter((l) => l.amount < 0).reduce((sum, l) => sum - l.amount, 0),
      balance: all.at(-1)?.balance ?? 0,
    };
  }, [query.data]);

  if (isApiError(query.error) && query.error.code === 'feature-disabled') return null;

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={t('suppliers.savingsLedger.title')}
        description={t('suppliers.savingsLedger.hint')}
      />
      <CardBody className="flex flex-col gap-md">
        {query.isPending ? (
          <Skeleton className="h-40" />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : lines.length === 0 ? (
          <EmptyState
            title={t('suppliers.savingsLedger.empty')}
            body={t('suppliers.savingsLedger.emptyHint')}
          />
        ) : (
          <>
            <dl className="grid gap-sm sm:grid-cols-3">
              <Total
                icon={PiggyBank}
                label={t('suppliers.savingsLedger.balance')}
                value={formatMoney(totals.balance)}
                strong
              />
              <Total
                icon={ArrowDownLeft}
                label={t('suppliers.savingsLedger.paidIn')}
                value={formatMoney(totals.paidIn)}
              />
              <Total
                icon={ArrowUpRight}
                label={t('suppliers.savingsLedger.takenOut')}
                value={formatMoney(totals.takenOut)}
              />
            </dl>

            <div className="max-h-96 overflow-y-auto rounded-md border border-border">
              <table
                className="w-full border-collapse text-data-cell"
                aria-label={t('suppliers.savingsLedger.title')}
              >
                <thead className="sticky top-0 bg-table-header">
                  <tr>
                    <th className="px-md py-sm text-left text-data-header text-text-secondary">
                      {t('suppliers.savingsLedger.month')}
                    </th>
                    <th className="px-md py-sm text-left text-data-header text-text-secondary">
                      {t('suppliers.savingsLedger.entry')}
                    </th>
                    <th className="px-md py-sm text-right text-data-header text-text-secondary">
                      {t('suppliers.savingsLedger.amount')}
                    </th>
                    <th className="px-md py-sm text-right text-data-header text-text-secondary">
                      {t('suppliers.savingsLedger.balanceAfter')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr
                      key={`${line.monthKey}-${index}`}
                      className={cn(
                        'border-t border-divider',
                        index % 2 === 1 && 'bg-table-row-alt',
                      )}
                    >
                      <td className="px-md py-sm text-text-primary">
                        {formatMonthKey(line.monthKey)}
                      </td>
                      <td className="px-md py-sm text-text-secondary">
                        {KNOWN_SOURCES.includes(line.source)
                          ? t(`suppliers.savingsLedger.source.${line.source}`)
                          : line.source}
                      </td>
                      <td
                        className={cn(
                          'numeric px-md py-sm text-right font-medium',
                          line.amount < 0 ? 'text-error' : 'text-success',
                        )}
                      >
                        {line.amount > 0 ? '+' : ''}
                        {formatMoney(line.amount)}
                      </td>
                      <td className="numeric px-md py-sm text-right text-text-primary">
                        {formatMoney(line.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Total({
  icon: Icon,
  label,
  value,
  strong = false,
}: {
  icon: typeof PiggyBank;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-sm rounded-md p-md',
        strong ? 'bg-primary-muted' : 'bg-surface-variant',
      )}
    >
      <Icon
        className={cn('size-icon-md shrink-0', strong ? 'text-primary' : 'text-text-secondary')}
        aria-hidden
      />
      <div className="min-w-0">
        <dt className="text-caption text-text-secondary">{label}</dt>
        <dd className="numeric text-subtitle text-text-primary">{value}</dd>
      </div>
    </div>
  );
}
