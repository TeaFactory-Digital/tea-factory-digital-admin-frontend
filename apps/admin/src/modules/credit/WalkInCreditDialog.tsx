/**
 * A credit request made at the office counter, recorded while the factory-system sync is
 * off.
 *
 * Without it, an advance handed over at the counter never reaches a bill: the console
 * calculates bills from the requests it knows about. The request joins the same queue as
 * one from the app (channel `office`), and the clerk who records it cannot also approve
 * it, so the counter does not bypass the second person the app's requests need.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  findManureProduct,
  installmentOptionsFor,
  manureAmount,
  type CreditFacility,
  type SupplierListItem,
  type WalkInCreditRequest,
} from '@tfd/domain';
import { useFeatureFlags, useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { SupplierPicker } from '@/components/SupplierPicker';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatAmount } from '@/lib/format';
import { useCreateWalkInCredit } from '@/modules/records/hooks';

const FACILITY_FLAGS = {
  advance: 'enableAdvances',
  loan: 'enableLoans',
  manure: 'enableManure',
} as const;

export function WalkInCreditDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const flags = useFeatureFlags();
  const { config } = useRuntimeConfig();
  const create = useCreateWalkInCredit();

  const facilities = (Object.keys(FACILITY_FLAGS) as CreditFacility[]).filter(
    (facility) => flags[FACILITY_FLAGS[facility]],
  );
  const [supplier, setSupplier] = useState<SupplierListItem | null>(null);
  const [facility, setFacility] = useState<CreditFacility>(facilities[0] ?? 'advance');
  const [amount, setAmount] = useState('');
  // Loans and manure are both repaid over a period the factory offers; an advance is not.
  const months = facility === 'advance' ? [] : installmentOptionsFor(config.creditRules, facility);
  const [repaymentMonths, setRepaymentMonths] = useState('');
  const chosenMonths = repaymentMonths || String(months[0] ?? '');
  const products = config.manureProducts ?? [];
  const [manureType, setManureType] = useState(products[0]?.name ?? '');
  const [quantityKg, setQuantityKg] = useState('');
  const [note, setNote] = useState('');

  /**
   * Manure is priced by the server from the catalogue, whatever amount is sent: the screen
   * shows that price instead of asking for one a clerk could mistype.
   */
  const product = findManureProduct(products, manureType);
  const manurePrice =
    facility === 'manure' && product && Number(quantityKg) > 0 ? manureAmount(product, Number(quantityKg)) : null;
  const amountNumber = facility === 'manure' ? (manurePrice ?? 0) : Number(amount);
  const amountOk =
    facility === 'manure' || (amount.trim() !== '' && Number.isFinite(amountNumber) && amountNumber > 0);
  const quantityOk = facility !== 'manure' || (Number(quantityKg) > 0 && manureType !== '');
  const ready = supplier !== null && amountOk && quantityOk && note.trim().length >= 10;

  async function submit() {
    if (!supplier) return;
    const body: WalkInCreditRequest = {
      supplierId: supplier.id,
      facility,
      amount: amountNumber,
      note: note.trim(),
      ...(facility !== 'advance' && chosenMonths ? { repaymentMonths: Number(chosenMonths) } : {}),
      ...(facility === 'manure' ? { manureType, quantityKg: Number(quantityKg) } : {}),
    };
    try {
      await create.mutateAsync(body);
      toast.success(t('records.walkIn.saved', { code: supplier.supplierCode }), t('records.walkIn.savedHint'));
      onClose();
    } catch (error) {
      toast.error(t('records.walkIn.failed'), t(errorMessageKey(error)));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title={t('records.walkIn.title')}
      description={t('records.walkIn.body')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={create.isPending} onClick={() => void submit()}>
            {t('records.walkIn.submit')}
          </Button>
        </>
      }
    >
      <div className="grid gap-md sm:grid-cols-2">
        <div className="flex flex-col gap-xs sm:col-span-2">
          <span className="text-label text-text-primary">{t('records.walkIn.supplier')} *</span>
          <SupplierPicker value={supplier} onChange={setSupplier} label={t('records.walkIn.supplier')} />
        </div>
        <Field label={t('records.walkIn.facility')} required>
          {({ id }) => (
            <Select id={id} value={facility} onChange={(event) => {
                setFacility(event.target.value as CreditFacility);
                setRepaymentMonths('');
              }}>
              {facilities.map((one) => (
                <option key={one} value={one}>
                  {t(`credit.facility.${one}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {facility === 'manure' ? (
          <div className="flex flex-col gap-xxs">
            <span className="text-label text-text-primary">{t('records.walkIn.amount')}</span>
            <span className="numeric text-body text-text-primary">
              {manurePrice === null ? '-' : formatAmount(manurePrice)}
            </span>
            <span className="text-caption text-text-secondary">{t('records.walkIn.manurePriced')}</span>
          </div>
        ) : (
          <Field label={t('records.walkIn.amount')} required error={amount && !amountOk ? t('records.walkIn.amountInvalid') : undefined}>
            {({ id, invalid }) => (
              <Input id={id} invalid={invalid} inputMode="decimal" className="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
            )}
          </Field>
        )}

        {facility !== 'advance' && months.length > 0 ? (
          <Field label={t('records.walkIn.repaymentMonths')} required className="sm:col-span-2">
            {({ id }) => (
              <Select id={id} value={chosenMonths} onChange={(event) => setRepaymentMonths(event.target.value)}>
                {months.map((one) => (
                  <option key={one} value={String(one)}>
                    {t('records.walkIn.months', { count: one })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {facility === 'manure' ? (
          <>
            <Field label={t('records.walkIn.manureType')} required>
              {({ id }) => (
                <Select id={id} value={manureType} onChange={(event) => setManureType(event.target.value)}>
                  {products.map((product) => (
                    <option key={product.name} value={product.name}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('records.walkIn.quantityKg')} required>
              {({ id }) => (
                <Input id={id} inputMode="decimal" className="numeric" value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} />
              )}
            </Field>
          </>
        ) : null}

        <Field label={t('records.walkIn.note')} required hint={t('records.walkIn.noteHint')} className="sm:col-span-2">
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
