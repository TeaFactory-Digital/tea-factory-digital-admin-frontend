/**
 * The month control M5 and M6 share.
 *
 * Shared rather than written twice because the interesting part is not the select — it
 * is `resolveMonthKey` next door, which validates the key in the URL against the
 * months the API actually returned instead of trusting it.
 */

import { useTranslation } from 'react-i18next';
import type { BillMonth } from '@tfd/domain';
import { Select } from '@/components/ui/Field';
import { formatMonthKey } from '@/lib/format';

export function MonthSelect({
  months,
  value,
  onChange,
  filter,
}: {
  months: BillMonth[] | undefined;
  value: string;
  onChange: (monthKey: string) => void;
  /** Narrow the options — M6 offers only published months, because only those pay. */
  filter?: (month: BillMonth) => boolean;
}) {
  const { t } = useTranslation();
  const options = (months ?? []).filter((month) => (filter ? filter(month) : true));

  return (
    <label className="flex flex-col gap-xs text-label text-text-primary">
      <span className="sr-only">{t('money.pickMonth')}</span>
      <Select
        aria-label={t('money.pickMonth')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        fullWidth={false}
      >
        {options.map((month) => (
          <option key={month.monthKey} value={month.monthKey}>
            {formatMonthKey(month.monthKey)}
          </option>
        ))}
      </Select>
    </label>
  );
}
