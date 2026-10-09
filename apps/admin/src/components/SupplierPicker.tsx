/**
 * Find a supplier by code or name, and pick one.
 *
 * The office types the passbook number most of the time, so the search starts at one
 * character for a code and shows the code first in every result.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { SupplierListItem } from '@tfd/domain';
import { SearchInput } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/states';
import { useDebounced } from '@/lib/useDebounced';
import { supplierRepository } from '@/services/repositories/supplierRepository';

export function SupplierPicker({
  value,
  onChange,
  label,
}: {
  value: SupplierListItem | null;
  onChange: (supplier: SupplierListItem | null) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const needle = useDebounced(text.trim(), 250);

  const results = useQuery({
    queryKey: ['supplier-picker', needle],
    queryFn: () => supplierRepository.list({ q: needle, status: 'active', page: 0, pageSize: 8 }),
    enabled: !value && needle.length >= 1,
    staleTime: 30_000,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-sm rounded-md border border-primary bg-primary-muted px-md py-sm">
        <span className="flex flex-col">
          <span className="numeric text-body-small font-semibold text-text-primary">{value.supplierCode}</span>
          <span className="text-caption text-text-secondary">{value.name}</span>
        </span>
        <button
          type="button"
          aria-label={t('records.picker.clear')}
          onClick={() => onChange(null)}
          className="rounded-sm p-xs text-text-secondary hover:bg-surface-variant"
        >
          <X className="size-icon-sm" aria-hidden />
        </button>
      </div>
    );
  }

  const items = results.data?.items ?? [];
  return (
    <div className="flex flex-col gap-xs">
      <SearchInput
        label={label}
        placeholder={t('records.picker.placeholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {needle.length >= 1 ? (
        <div className="max-h-56 overflow-y-auto rounded-md border border-border">
          {results.isPending ? (
            <div className="flex justify-center p-md">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <p className="p-md text-body-small text-text-secondary">{t('records.picker.none')}</p>
          ) : (
            <ul role="listbox" aria-label={label}>
              {items.map((supplier) => (
                <li key={supplier.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => onChange(supplier)}
                    className="flex w-full items-center gap-md border-b border-divider px-md py-sm text-left last:border-b-0 hover:bg-surface-variant"
                  >
                    <span className="numeric w-24 shrink-0 text-body-small font-semibold text-text-primary">
                      {supplier.supplierCode}
                    </span>
                    <span className="flex-1 text-body-small text-text-primary">{supplier.name}</span>
                    <span className="text-caption text-text-secondary">{supplier.collectionPoint?.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
