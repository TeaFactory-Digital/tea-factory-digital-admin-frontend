/**
 * Corrections after a published bill (C5): the supplier's list, and the manager's form.
 *
 * A published bill is never edited. A balance found wrong (loan, fertilizer, savings) is
 * corrected at once in its ledger; a payment found wrong lands on the supplier's next bill
 * as a "Correction" line. The rules are `correctionProblems` in `@tfd/domain`, so the form
 * withholds the button for exactly what the server would refuse.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import {
  CORRECTION_TARGETS,
  correctionProblems,
  round2,
  type CorrectionTarget,
  type SupplierCorrection,
  type SupplierCorrections,
} from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDate, formatMonthKey, formatSignedAmount } from '@/lib/format';
import { useCreateCorrection, useSupplierCorrections } from '@/modules/records/hooks';

export interface CorrectionBalances {
  loan: number;
  manure: number;
  savings: number;
}

export function CorrectionsCard({ supplierId, balances }: { supplierId: string; balances: CorrectionBalances }) {
  const { t } = useTranslation();
  const canPost = useCan('billing', 'approve');
  const query = useSupplierCorrections(supplierId, true);
  const [posting, setPosting] = useState(false);
  const data = query.data;

  return (
    <Card>
      <CardHeader
        title={t('corrections.title')}
        description={t('corrections.body')}
        actions={
          canPost && data && data.publishedMonthKeys.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Plus className="size-icon-sm" aria-hidden />}
              onClick={() => setPosting(true)}
            >
              {t('corrections.post')}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {query.isPending ? (
          <Spinner />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <p className="text-body-small text-text-secondary">
            {data && data.publishedMonthKeys.length === 0 ? t('corrections.noBills') : t('corrections.none')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {data.items.map((item) => (
              <CorrectionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardBody>

      {posting && data ? (
        <CorrectionDialog supplierId={supplierId} data={data} balances={balances} onClose={() => setPosting(false)} />
      ) : null}
    </Card>
  );
}

function CorrectionRow({ item }: { item: SupplierCorrection }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-xxs py-sm">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="text-body-small font-medium text-text-primary">
          {t(`corrections.target.${item.target}`)} · {t('corrections.forMonth', { month: formatMonthKey(item.correctsMonthKey) })}
        </span>
        <span className="numeric text-body-small font-medium text-text-primary">{formatSignedAmount(item.amount)}</span>
      </div>
      <p className="text-body-small text-text-secondary">{item.reason}</p>
      <div className="flex flex-wrap items-center gap-sm text-caption text-text-secondary">
        <Badge tone={item.status === 'applied' ? 'success' : 'warning'} dot>
          {item.status === 'applied'
            ? item.appliedMonthKey
              ? t('corrections.appliedOn', { month: formatMonthKey(item.appliedMonthKey) })
              : t('corrections.applied')
            : t('corrections.pending')}
        </Badge>
        <span>{t('corrections.by', { name: item.createdByName, when: formatDate(item.createdAt) })}</span>
      </div>
    </li>
  );
}

function CorrectionDialog({
  supplierId,
  data,
  balances,
  onClose,
}: {
  supplierId: string;
  data: SupplierCorrections;
  balances: CorrectionBalances;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateCorrection(supplierId);
  // A payment correction needs the next bill calculated here; an imported one is the factory's.
  const targets = CORRECTION_TARGETS.filter((target) => target !== 'payment' || data.billSource === 'calculated');
  const [target, setTarget] = useState<CorrectionTarget>(targets[0]!);
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(data.publishedMonthKeys[0] ?? '');
  const [reason, setReason] = useState('');

  const value = Number(amount);
  const amountOk = amount.trim() !== '' && Number.isFinite(value) && value > 0;
  const signed = amountOk ? round2(direction === 'up' ? value : -value) : 0;
  const input = { target, amount: signed, correctsMonthKey: month, reason };
  const problems = correctionProblems(input, {
    publishedMonthKeys: data.publishedMonthKeys,
    balances,
    billSource: data.billSource,
  });
  const ready = amountOk && problems.length === 0;

  async function submit() {
    try {
      await create.mutateAsync({ ...input, reason: reason.trim() });
      toast.success(t(target === 'payment' ? 'corrections.savedPayment' : 'corrections.savedBalance'));
      onClose();
    } catch (error) {
      toast.error(t('corrections.saveFailed'), t(errorMessageKey(error)));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title={t('corrections.dialogTitle')}
      description={t('corrections.dialogBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={create.isPending} onClick={() => void submit()}>
            {t('corrections.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-md sm:grid-cols-2">
        <Field label={t('corrections.what')} required className="sm:col-span-2">
          {({ id }) => (
            <Select id={id} value={target} onChange={(event) => setTarget(event.target.value as CorrectionTarget)}>
              {targets.map((one) => (
                <option key={one} value={one}>
                  {t(`corrections.target.${one}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('corrections.direction')} required className="sm:col-span-2">
          {({ id }) => (
            <Select id={id} value={direction} onChange={(event) => setDirection(event.target.value as 'up' | 'down')}>
              <option value="up">{t(`corrections.up.${target}`)}</option>
              <option value="down">{t(`corrections.down.${target}`)}</option>
            </Select>
          )}
        </Field>
        <Field
          label={t('corrections.amount')}
          required
          error={amount.trim() !== '' && !amountOk ? t('corrections.amountInvalid') : undefined}
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              inputMode="decimal"
              className="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          )}
        </Field>
        <Field label={t('corrections.month')} required hint={t('corrections.monthHint')}>
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={month} onChange={(event) => setMonth(event.target.value)}>
              {data.publishedMonthKeys.map((key) => (
                <option key={key} value={key}>
                  {formatMonthKey(key)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t('common.reason')}
          required
          hint={t(target === 'payment' ? 'corrections.reasonHintPayment' : 'corrections.reasonHint')}
          className="sm:col-span-2"
        >
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          )}
        </Field>
      </div>

      <p className="mt-md text-body-small text-text-secondary">
        {t(target === 'payment' ? 'corrections.effectPayment' : 'corrections.effectBalance')}
      </p>
      {problems.includes('below-zero') ? (
        <p role="alert" className="mt-sm text-body-small text-error">
          {t('corrections.problem.below-zero')}
        </p>
      ) : null}
      {target !== 'payment' && data.billSource === 'imported' ? (
        <p className="mt-sm rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
          {t('corrections.importedWarning')}
        </p>
      ) : null}
    </Dialog>
  );
}
