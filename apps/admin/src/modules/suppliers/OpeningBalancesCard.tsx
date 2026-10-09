/**
 * What the supplier owed and held when this console took over their records.
 *
 * Shown only while the factory-system sync is off. Entered once: the first bill generated
 * for the supplier starts from these figures, and from then on the bills carry the
 * balances forward, so the card locks and says why.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Pencil } from 'lucide-react';
import type { OpeningBalances } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDate, formatMoney, formatMonthKey } from '@/lib/format';
import { useOpeningBalances, useSaveOpeningBalances } from '@/modules/records/hooks';

const AMOUNTS = ['advance', 'loan', 'manure', 'teaPackets', 'savings', 'previousDebt'] as const;
type Amount = (typeof AMOUNTS)[number];

/** This month, `YYYY-MM`: the usual first month a console-calculated bill covers. */
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function OpeningBalancesCard({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();
  const canWrite = useCan('suppliers', 'write');
  const query = useOpeningBalances(supplierId, true);
  const [editing, setEditing] = useState(false);

  const record = query.data;

  return (
    <Card>
      <CardHeader
        title={t('records.opening.title')}
        description={t('records.opening.body')}
        actions={
          canWrite && record?.editable !== false ? (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Pencil className="size-icon-sm" aria-hidden />}
              onClick={() => setEditing(true)}
            >
              {record ? t('records.opening.edit') : t('records.opening.enter')}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {query.isPending ? (
          <Spinner />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !record ? (
          <p className="text-body-small text-text-secondary">{t('records.opening.none')}</p>
        ) : (
          <div className="flex flex-col gap-sm">
            <dl className="grid grid-cols-2 gap-x-lg gap-y-xs">
              <dt className="text-body-small text-text-secondary">{t('records.opening.asOfMonth')}</dt>
              <dd className="text-body-small font-medium text-text-primary">{formatMonthKey(record.asOfMonth)}</dd>
              {AMOUNTS.map((key) => (
                <OpeningRow key={key} label={t(`records.opening.field.${key}`)} value={record[key]} />
              ))}
            </dl>
            <p className="flex items-center gap-xs text-caption text-text-secondary">
              {record.editable ? null : <Lock className="size-icon-xs" aria-hidden />}
              {record.editable
                ? t('records.opening.enteredBy', { name: record.updatedByName, when: formatDate(record.updatedAt) })
                : t('records.opening.locked')}
            </p>
          </div>
        )}
      </CardBody>

      {editing ? (
        <OpeningBalancesDialog
          supplierId={supplierId}
          initial={record ?? null}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </Card>
  );
}

function OpeningRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-body-small text-text-secondary">{label}</dt>
      <dd className="numeric text-body-small text-text-primary">{formatMoney(value)}</dd>
    </>
  );
}

function OpeningBalancesDialog({
  supplierId,
  initial,
  onClose,
}: {
  supplierId: string;
  initial: OpeningBalances | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveOpeningBalances(supplierId);
  const [asOfMonth, setAsOfMonth] = useState(initial?.asOfMonth ?? currentMonthKey());
  const [amounts, setAmounts] = useState<Record<Amount, string>>(() =>
    Object.fromEntries(AMOUNTS.map((key) => [key, initial ? String(initial[key]) : '0'])) as Record<Amount, string>,
  );
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [initial]);

  const invalid = AMOUNTS.filter((key) => {
    const n = Number(amounts[key]);
    return amounts[key].trim() === '' || !Number.isFinite(n) || n < 0;
  });
  const monthOk = /^\d{4}-(0[1-9]|1[0-2])$/.test(asOfMonth);
  const ready = invalid.length === 0 && monthOk && note.trim().length >= 10;

  async function submit() {
    try {
      await save.mutateAsync({
        asOfMonth,
        ...(Object.fromEntries(AMOUNTS.map((key) => [key, Number(amounts[key])])) as Record<Amount, number>),
        note: note.trim(),
      });
      toast.success(t('records.opening.saved'));
      onClose();
    } catch (error) {
      toast.error(t('records.opening.saveFailed'), t(errorMessageKey(error)));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title={t('records.opening.dialogTitle')}
      description={t('records.opening.dialogBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={save.isPending} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-md sm:grid-cols-2">
        <Field label={t('records.opening.asOfMonth')} required hint={t('records.opening.asOfMonthHint')} className="sm:col-span-2">
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} type="month" value={asOfMonth} onChange={(event) => setAsOfMonth(event.target.value)} />
          )}
        </Field>
        {AMOUNTS.map((key) => (
          <Field
            key={key}
            label={t(`records.opening.field.${key}`)}
            required
            error={invalid.includes(key) ? t('records.opening.amountInvalid') : undefined}
          >
            {({ id, invalid: isInvalid }) => (
              <Input
                id={id}
                invalid={isInvalid}
                inputMode="decimal"
                className="numeric"
                value={amounts[key]}
                onChange={(event) => setAmounts({ ...amounts, [key]: event.target.value })}
              />
            )}
          </Field>
        ))}
        <Field label={t('common.reason')} required hint={t('records.opening.noteHint')} className="sm:col-span-2">
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
