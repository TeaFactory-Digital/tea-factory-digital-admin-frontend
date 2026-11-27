/**
 * "Only 5014 · Wasantha Fernando ✕" at the head of a queue's filters (27 November 2026),
 * while the queue is narrowed to one supplier (`?supplierId=`, from the supplier's page).
 *
 * The narrowing used to be invisible: the search box stayed empty, the list was short, and
 * nothing said why. The name opens the supplier; the cross shows every supplier again.
 */

import { useTranslation } from 'react-i18next';
import { User, X } from 'lucide-react';
import { InlineLink } from '@/components/ui/InlineLink';
import { useSupplier } from '@/modules/suppliers/hooks';

export function SupplierFilterChip({ supplierId, onClear }: { supplierId: string; onClear: () => void }) {
  const { t } = useTranslation();
  const { data } = useSupplier(supplierId);
  const name = data ? `${data.supplierCode} · ${data.name}` : '…';

  return (
    <span
      role="status"
      className="tfd-chip-in inline-flex max-w-full items-center gap-xs rounded-full border border-primary/30 bg-primary-muted py-xxs pr-xxs pl-sm text-label text-primary"
    >
      <User className="size-icon-xs shrink-0" aria-hidden />
      <span className="min-w-0 truncate">
        {t('queue.onlySupplierPrefix')}{' '}
        <InlineLink to={`/suppliers/${supplierId}`} arrow={false} className="font-semibold">
          {name}
        </InlineLink>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={t('queue.clearSupplier')}
        title={t('queue.clearSupplier')}
        className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="size-icon-xs" aria-hidden />
      </button>
    </span>
  );
}
