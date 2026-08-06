/**
 * The fertilizer a supplier may ask for, with its bag size and price (§21.10).
 *
 * Not a `StringListEditor`, because a name is not enough: a supplier asks for *two bags of
 * urea* and the account has to carry a rupee figure. Three fields per row, and the console
 * derives the amount from them — a hand-typed price on a request is a price nobody can check
 * against a list.
 *
 * The line under each row is the point of the screen: **what one bag costs and what a
 * request for it would put on an account.** Somebody setting a price should see the figure
 * the supplier will owe, not just the number they typed.
 */

import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { manureAmount, manureProductProblems, type ManureProduct } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { formatAmount, formatKg } from '@/lib/format';

export function ManureCatalogue({
  products,
  onChange,
  readOnly,
}: {
  products: ManureProduct[];
  onChange: (next: ManureProduct[]) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const problems = manureProductProblems(products);

  const set = (index: number, patch: Partial<ManureProduct>) =>
    onChange(products.map((one, i) => (i === index ? { ...one, ...patch } : one)));

  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="text-label text-text-primary">{t('config.manureProducts')}</legend>
      <p className="text-caption text-text-secondary">{t('config.manureProductsHint')}</p>

      <ul className="flex flex-col gap-xs">
        {products.map((product, index) => (
          <li
            key={index}
            className="flex flex-col gap-xxs rounded-md border border-border px-sm py-xs"
          >
            <div className="flex flex-wrap items-center gap-sm">
              <Input
                aria-label={t('config.manure.name')}
                className="min-w-48 flex-1"
                fullWidth={false}
                placeholder="Urea"
                disabled={readOnly}
                value={product.name}
                onChange={(event) => set(index, { name: event.target.value })}
              />
              <Input
                aria-label={t('config.manure.packKg')}
                className="numeric w-28"
                fullWidth={false}
                type="number"
                min={1}
                step={1}
                disabled={readOnly}
                value={product.packKg}
                onChange={(event) => set(index, { packKg: Number(event.target.value) || 0 })}
              />
              <Input
                aria-label={t('config.manure.pricePerPack')}
                className="numeric w-32"
                fullWidth={false}
                type="number"
                min={0}
                step={50}
                disabled={readOnly}
                value={product.pricePerPack}
                onChange={(event) =>
                  set(index, { pricePerPack: Number(event.target.value) || 0 })
                }
              />
              {!readOnly ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('config.manure.remove', { name: product.name || '—' })}
                  onClick={() => onChange(products.filter((_, i) => i !== index))}
                  iconLeft={<Trash2 className="size-icon-sm" aria-hidden />}
                />
              ) : null}
            </div>

            {/* What a supplier would actually owe. Bags round **up** — a store issues whole
                sacks, so 60 kg of a 50 kg product is two bags and two bags' worth. */}
            {product.packKg > 0 ? (
              <p className="text-caption text-text-secondary">
                {t('config.manure.example', {
                  pack: formatKg(product.packKg),
                  price: formatAmount(product.pricePerPack),
                  quantity: formatKg(product.packKg * 2),
                  amount: formatAmount(manureAmount(product, product.packKg * 2)),
                })}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {problems.length > 0 ? (
        <ul className="flex flex-col gap-xxs">
          {problems.map((problem) => (
            <li key={problem} className="text-caption text-error">
              {t(`config.manure.problem.${problem}`)}
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          iconLeft={<Plus className="size-icon-sm" aria-hidden />}
          // 50 kg because that is the sack a Sri Lankan supplier is handed.
          onClick={() => onChange([...products, { name: '', packKg: 50, pricePerPack: 0 }])}
        >
          {t('config.addManureType')}
        </Button>
      ) : null}
    </fieldset>
  );
}
