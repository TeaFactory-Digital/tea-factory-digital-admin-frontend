/**
 * Current against requested, field by field.
 *
 * Two layouts of the same rows: `table` for the detail screen, where the office reads the
 * whole record, and `list` for the decision dialog, where only what changes matters and
 * there is no room for three columns.
 */

import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { AdminChangeRequest, ChangeRequestType } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { compareSummaries, type SummaryRow } from '@/lib/changeSummary';

export function ChangeComparison({
  request,
  layout = 'table',
}: {
  request: Pick<AdminChangeRequest, 'type' | 'currentSummary' | 'requestedSummary'>;
  layout?: 'table' | 'list';
}) {
  const { t } = useTranslation();
  const rows = compareSummaries(request.currentSummary, request.requestedSummary);
  const typeLabel = t(`changeRequests.type.${request.type as ChangeRequestType}`);

  if (layout === 'list') {
    // In the dialog, only the rows that change; all of them if, oddly, none does.
    const shown = rows.some((row) => row.changed) ? rows.filter((row) => row.changed) : rows;
    return (
      <ul className="flex flex-col gap-sm rounded-md border border-border bg-surface-variant p-md">
        {shown.map((row) => (
          <li key={row.label ?? 'value'} className="flex flex-col gap-xxs">
            <span className="text-caption text-text-secondary">{row.label ?? typeLabel}</span>
            <span className="flex flex-wrap items-center gap-sm text-body-small">
              <Value value={row.current} className="text-text-secondary line-through" />
              <ArrowRight className="size-icon-sm shrink-0 text-text-secondary" aria-hidden />
              <Value value={row.requested} className="font-semibold text-text-primary" />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-body-small">
        <thead className="bg-table-header">
          <tr>
            <th scope="col" className="px-md py-sm text-left text-data-header text-text-secondary">
              {t('changeRequests.detail.field')}
            </th>
            <th scope="col" className="px-md py-sm text-left text-data-header text-text-secondary">
              {t('changeRequests.detail.currentHeading')}
            </th>
            <th scope="col" className="px-md py-sm text-left text-data-header text-primary">
              {t('changeRequests.detail.requestedHeading')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ComparisonRow key={row.label ?? 'value'} row={row} fallbackLabel={typeLabel} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonRow({ row, fallbackLabel }: { row: SummaryRow; fallbackLabel: string }) {
  const { t } = useTranslation();
  return (
    <tr className="border-t border-divider align-top">
      <th scope="row" className="px-md py-md text-left font-normal text-text-secondary">
        <span className="flex flex-wrap items-center gap-xs">
          {row.label ?? fallbackLabel}
          {row.changed ? <Badge tone="primary">{t('changeRequests.detail.changed')}</Badge> : null}
        </span>
      </th>
      <td className="px-md py-md">
        <Value value={row.current} className="text-text-primary" />
      </td>
      <td className={cn('px-md py-md', row.changed && 'bg-primary-muted')}>
        <Value
          value={row.requested}
          className={row.changed ? 'font-semibold text-text-primary' : 'text-text-secondary'}
        />
      </td>
    </tr>
  );
}

/** One value: translated when it is a known code (`bankTransfer`), "Not set" when empty. */
function Value({ value, className }: { value: string | null; className?: string }) {
  const { t, i18n } = useTranslation();
  if (value === null) {
    return <span className="text-text-secondary italic">{t('changeRequests.detail.notSet')}</span>;
  }
  const paymentKey = `suppliers.payment.${value}`;
  return (
    <span className={cn('break-words', className)}>
      {i18n.exists(paymentKey) ? t(paymentKey) : value}
    </span>
  );
}
