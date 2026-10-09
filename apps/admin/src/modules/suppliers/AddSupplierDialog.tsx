/**
 * Register a supplier in the console, while the factory-system sync is off.
 *
 * **The code is the factory's own**, the number on the passbook. The form says so, because
 * it is what lets the sync match this supplier later instead of creating a second one, and
 * it is the number the supplier types to sign in to the app.
 *
 * Bank details are asked for only when the supplier is paid by bank transfer, and are the
 * one thing the app cannot change without the office's approval afterwards.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supplierRegistrationSchema, type NewSupplier, type PaymentMethod } from '@tfd/domain';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { useCreateSupplier } from '@/modules/records/hooks';

const PAYMENT_METHODS: PaymentMethod[] = ['bankTransfer', 'cheque', 'cash'];

type Form = {
  supplierCode: string;
  name: string;
  nic: string;
  phone: string;
  collectionPoint: string;
  paymentMethod: PaymentMethod;
  savingsPerKg: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  homeAddress: string;
  estateAddress: string;
};

export function AddSupplierDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { config } = useRuntimeConfig();
  const create = useCreateSupplier();

  const empty: Form = {
    supplierCode: '',
    name: '',
    nic: '',
    phone: '',
    collectionPoint: config.collectionPoints[0]?.name ?? '',
    paymentMethod: 'bankTransfer',
    savingsPerKg: String(config.savings.perKgOptions[0] ?? 0),
    bankName: '',
    branchName: '',
    accountNumber: '',
    homeAddress: '',
    estateAddress: '',
  };
  const [form, setForm] = useState<Form>(empty);
  const [submitted, setSubmitted] = useState(false);
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  const parsed = supplierRegistrationSchema.safeParse({
    ...form,
    savingsPerKg: Number(form.savingsPerKg),
  });
  const errors = useMemo(() => {
    const out: Partial<Record<keyof Form, string>> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Form;
        out[key] ??= issue.message;
      }
    }
    if (form.paymentMethod === 'bankTransfer') {
      if (!form.bankName) out.bankName = 'validation.required';
      if (!form.branchName) out.branchName = 'validation.required';
      if (!/^\d{6,20}$/.test(form.accountNumber.replace(/\s/g, ''))) {
        out.accountNumber = 'records.supplier.accountInvalid';
      }
    }
    return out;
  }, [parsed, form]);
  const show = (key: keyof Form) => (submitted && errors[key] ? t(errors[key]!) : undefined);

  const branches = config.banks.find((bank) => bank.name === form.bankName)?.branches ?? [];

  function close() {
    setForm(empty);
    setSubmitted(false);
    onClose();
  }

  async function submit() {
    setSubmitted(true);
    if (!parsed.success || Object.keys(errors).length > 0) return;
    const body: NewSupplier = {
      ...parsed.data,
      phone: parsed.data.phone || undefined,
      email: undefined,
      dateOfBirth: undefined,
      ...(form.paymentMethod === 'bankTransfer'
        ? {
            bankDetails: {
              bankName: form.bankName,
              branchName: form.branchName,
              accountNumber: form.accountNumber.replace(/\s/g, ''),
            },
          }
        : {}),
    };
    try {
      const created = await create.mutateAsync(body);
      toast.success(t('records.supplier.added', { name: body.name, code: body.supplierCode }));
      close();
      navigate(`/suppliers/${created.id}`);
    } catch (error) {
      toast.error(t('records.supplier.addFailed'), t(errorMessageKey(error)));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      size="md"
      title={t('records.supplier.addTitle')}
      description={t('records.supplier.addBody')}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={() => void submit()}>
            {t('records.supplier.add')}
          </Button>
        </>
      }
    >
      <div className="grid gap-md sm:grid-cols-2">
        <Field label={t('records.supplier.code')} required hint={t('records.supplier.codeHint')} error={show('supplierCode')}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              autoFocus
              value={form.supplierCode}
              placeholder="5147"
              onChange={(event) => set({ supplierCode: event.target.value })}
            />
          )}
        </Field>
        <Field label={t('records.supplier.name')} required error={show('name')}>
          {({ id, invalid, required }) => (
            <Input id={id} invalid={invalid} required={required} value={form.name} onChange={(event) => set({ name: event.target.value })} />
          )}
        </Field>
        <Field label={t('records.supplier.nic')} required error={show('nic')}>
          {({ id, invalid, required }) => (
            <Input id={id} invalid={invalid} required={required} value={form.nic} placeholder="883210456V" onChange={(event) => set({ nic: event.target.value })} />
          )}
        </Field>
        <Field label={t('records.supplier.phone')} error={show('phone')}>
          {({ id, invalid }) => (
            <Input id={id} invalid={invalid} type="tel" value={form.phone} placeholder="0771234567" onChange={(event) => set({ phone: event.target.value })} />
          )}
        </Field>
        <Field label={t('records.supplier.collectionPoint')} required error={show('collectionPoint')}>
          {({ id }) => (
            <Select id={id} value={form.collectionPoint} onChange={(event) => set({ collectionPoint: event.target.value })}>
              {config.collectionPoints.map((point) => (
                <option key={point.id} value={point.name}>
                  {point.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('records.supplier.savingsPerKg')} required>
          {({ id }) => (
            <Select id={id} value={form.savingsPerKg} onChange={(event) => set({ savingsPerKg: event.target.value })}>
              {config.savings.perKgOptions.map((option) => (
                <option key={option} value={String(option)}>
                  {option === 0 ? t('suppliers.optedOut') : t('records.supplier.perKg', { value: option })}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('records.supplier.paymentMethod')} required className="sm:col-span-2">
          {({ id }) => (
            <Select id={id} value={form.paymentMethod} onChange={(event) => set({ paymentMethod: event.target.value as PaymentMethod })}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`suppliers.payment.${method}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {form.paymentMethod === 'bankTransfer' ? (
          <>
            <Field label={t('records.supplier.bank')} required error={show('bankName')}>
              {({ id }) => (
                <Select id={id} value={form.bankName} onChange={(event) => set({ bankName: event.target.value, branchName: '' })}>
                  <option value="">{t('records.supplier.chooseBank')}</option>
                  {config.banks.map((bank) => (
                    <option key={bank.name} value={bank.name}>
                      {bank.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('records.supplier.branch')} required error={show('branchName')}>
              {({ id }) => (
                <Select id={id} value={form.branchName} disabled={!form.bankName} onChange={(event) => set({ branchName: event.target.value })}>
                  <option value="">{t('records.supplier.chooseBranch')}</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('records.supplier.accountNumber')} required error={show('accountNumber')} className="sm:col-span-2">
              {({ id, invalid, required }) => (
                <Input id={id} invalid={invalid} required={required} inputMode="numeric" value={form.accountNumber} onChange={(event) => set({ accountNumber: event.target.value })} />
              )}
            </Field>
          </>
        ) : null}

        <Field label={t('records.supplier.homeAddress')} className="sm:col-span-2">
          {({ id }) => <Input id={id} value={form.homeAddress} onChange={(event) => set({ homeAddress: event.target.value })} />}
        </Field>
        <Field label={t('records.supplier.estateAddress')} className="sm:col-span-2">
          {({ id }) => <Input id={id} value={form.estateAddress} onChange={(event) => set({ estateAddress: event.target.value })} />}
        </Field>
      </div>
    </Dialog>
  );
}
