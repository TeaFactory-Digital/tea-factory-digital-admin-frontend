/**
 * The transport rate this supplier pays per kilo, and where it comes from.
 *
 * Shown only while the factory-system sync is off, when the bill is calculated here. Most
 * suppliers pay their collection point's rate (or the factory's, for a point without one);
 * the office may give a supplier their own, with a reason, for an estate the lorry has to
 * go further for. The card always says which of the three applies, so nobody has to work
 * out why two neighbours paid different transport.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { transportRateFor } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatAmount } from '@/lib/format';
import { useDeductionRates } from '@/modules/months/deductionRateHooks';
import { useSaveTransportRate } from '@/modules/records/hooks';

const NOTE_MIN = 10;

export function TransportRateCard({
  supplierId,
  point,
  ownRate,
}: {
  supplierId: string;
  point: { id: string; name: string } | null;
  ownRate: number | null;
}) {
  const { t } = useTranslation();
  const canWrite = useCan('suppliers', 'write');
  const rates = useDeductionRates();
  const [editing, setEditing] = useState(false);

  const factoryRates = rates.data?.rates;
  const pointRate = factoryRates ? transportRateFor(factoryRates, point?.id) : null;
  const pointHasOwn = point ? factoryRates?.transportByPoint?.[point.id] !== undefined : false;
  const applied = ownRate ?? pointRate;

  const source =
    ownRate !== null
      ? t('records.transport.source.supplier')
      : pointHasOwn && point
        ? t('records.transport.source.point', { point: point.name })
        : t('records.transport.source.factory');

  return (
    <Card>
      <CardHeader
        title={t('records.transport.title')}
        description={t('records.transport.body')}
        actions={
          canWrite ? (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Pencil className="size-icon-sm" aria-hidden />}
              onClick={() => setEditing(true)}
            >
              {t('records.transport.change')}
            </Button>
          ) : null
        }
      />
      <CardBody className="flex flex-col gap-xs">
        {rates.isPending && ownRate === null ? (
          <Spinner />
        ) : (
          <div className="flex flex-wrap items-center gap-sm">
            <span className="numeric text-title font-semibold text-text-primary">
              {applied === null ? '-' : t('records.transport.perKg', { rate: formatAmount(applied) })}
            </span>
            <Badge tone={ownRate !== null ? 'info' : 'neutral'}>{source}</Badge>
          </div>
        )}
        {ownRate !== null && pointRate !== null ? (
          <p className="text-caption text-text-secondary">
            {t('records.transport.otherwise', { rate: formatAmount(pointRate) })}
          </p>
        ) : null}
      </CardBody>

      {editing ? (
        <TransportRateDialog
          supplierId={supplierId}
          ownRate={ownRate}
          pointRate={pointRate}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </Card>
  );
}

function TransportRateDialog({
  supplierId,
  ownRate,
  pointRate,
  onClose,
}: {
  supplierId: string;
  ownRate: number | null;
  pointRate: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveTransportRate(supplierId);
  const [value, setValue] = useState(ownRate === null ? '' : String(ownRate));
  const [note, setNote] = useState('');

  // Empty is a real answer: back on the point's rate.
  const next = value.trim() === '' ? null : Number(value);
  const invalid = next !== null && (!Number.isFinite(next) || next < 0);
  const ready = !invalid && next !== ownRate && note.trim().length >= NOTE_MIN;

  async function submit() {
    try {
      await save.mutateAsync({ transportPerKg: next, note: note.trim() });
      toast.success(t('records.transport.saved'));
      onClose();
    } catch (error) {
      toast.error(t('records.transport.saveFailed'), t(errorMessageKey(error)));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
      title={t('records.transport.dialogTitle')}
      description={t('records.transport.dialogBody')}
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
      <div className="flex flex-col gap-md">
        <Field
          label={t('records.transport.ownRate')}
          hint={
            pointRate === null
              ? t('records.transport.ownRateHintPlain')
              : t('records.transport.ownRateHint', { rate: formatAmount(pointRate) })
          }
          error={invalid ? t('records.transport.invalid') : undefined}
        >
          {({ id, describedBy, invalid: isInvalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={isInvalid}
              inputMode="decimal"
              className="numeric"
              placeholder={pointRate === null ? '' : String(pointRate)}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>
        <Field label={t('common.reason')} required hint={t('records.transport.noteHint')}>
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
