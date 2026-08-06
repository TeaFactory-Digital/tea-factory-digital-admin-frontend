/**
 * §21.10's rates, on M4's screen — **proposed by one person, approved by another.**
 *
 * Here rather than on the configuration screen for two reasons that are the same reason: the
 * capability is `ratesAndMonthClose`, and the factory said a change needs a second person.
 * M14 saves immediately, which is right for a logo and wrong for a figure that re-prices
 * every account in the factory. This is the shape M4 already has for the monthly rate.
 *
 * The card always says **whose figures these are**. A factory that has never set its own is
 * running on the numbers the console shipped with, and presenting those as a decision
 * somebody made is how an invented transport charge ends up quoted at a supplier.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Send, X } from 'lucide-react';
import { DEFAULT_DEDUCTION_RATES, deductionRateDiff, type DeductionRates } from '@tfd/domain';
import { useAuthStore, useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatAmount, formatDateTime } from '@/lib/format';
import {
  useDecideDeductionRates,
  useDeductionRates,
  useProposeDeductionRates,
} from './deductionRateHooks';

const NOTE_MIN = 10;
const FACILITIES = ['advance', 'loan', 'manure'] as const;

export function DeductionRatesCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const canPropose = useCan('ratesAndMonthClose', 'write');
  const canApprove = useCan('ratesAndMonthClose', 'approve');
  const meId = useAuthStore((s) => s.user?.id);

  const query = useDeductionRates();
  const propose = useProposeDeductionRates();
  const decide = useDecideDeductionRates();

  const [draft, setDraft] = useState<DeductionRates | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  if (query.isPending) {
    return (
      <Card>
        <CardBody className="flex justify-center py-xl">
          <Spinner />
        </CardBody>
      </Card>
    );
  }
  if (query.error || !query.data) return null;

  const { rates, customised, pending } = query.data;
  const editing = draft ?? rates;
  const changes = deductionRateDiff(rates, editing);
  const dirty = changes.length > 0;
  // BR-501, said before the button is pressed rather than after the server refuses.
  const wouldBeSelfApproval = pending?.proposedById === meId;

  async function submitProposal() {
    try {
      await propose.mutateAsync({ rates: editing, reason: reason.trim() });
      setDraft(null);
      setReason('');
      toast.success(t('rates.deduction.proposed'), t('rates.deduction.proposedHint'));
    } catch (cause) {
      toast.error(t('rates.deduction.proposeFailed'), t(errorMessageKey(cause)));
    }
  }

  async function submitDecision(verb: 'approve' | 'reject') {
    if (!pending) return;
    try {
      await decide.mutateAsync({ id: pending.id, verb, note: note.trim() || undefined });
      setNote('');
      toast.success(t(`rates.deduction.${verb}d`));
    } catch (cause) {
      toast.error(t('rates.deduction.decideFailed'), t(errorMessageKey(cause)));
    }
  }

  const field = (label: string, value: number, onChange: (next: number) => void, step: number) => (
    <Field label={label} key={label}>
      {({ id }) => (
        <Input
          id={id}
          type="number"
          min={0}
          step={step}
          className="numeric"
          disabled={!canPropose || pending !== null}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      )}
    </Field>
  );

  return (
    <Card>
      <CardHeader
        title={t('rates.deduction.title')}
        description={t('rates.deduction.description')}
        actions={
          /* Whose figures these are. Without it, an invented default reads as a decision. */
          <Badge tone={customised ? 'info' : 'warning'}>
            {customised ? t('rates.deduction.customised') : t('rates.deduction.shipped')}
          </Badge>
        }
      />

      <CardBody className="flex flex-col gap-md">
        {!customised ? (
          <p className="rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
            {t('rates.deduction.shippedHint', {
              transport: formatAmount(DEFAULT_DEDUCTION_RATES.transportPerKg),
            })}
          </p>
        ) : null}

        <div className="grid gap-md md:grid-cols-2">
          {field(t('rates.deduction.transportPerKg'), editing.transportPerKg, (next) =>
            setDraft({ ...editing, transportPerKg: next }), 0.25)}
          {field(t('rates.deduction.stamps'), editing.stamps, (next) =>
            setDraft({ ...editing, stamps: next }), 5)}
        </div>

        <fieldset className="flex flex-col gap-sm">
          <legend className="text-label text-text-primary">{t('rates.deduction.caps')}</legend>
          {/* A cap, not a schedule — the supplier picks the period, this stops a bad month
              disappearing into a repayment they agreed to when they were plucking well. */}
          <p className="text-caption text-text-secondary">{t('rates.deduction.capsHint')}</p>
          <div className="grid gap-md md:grid-cols-3">
            {FACILITIES.map((facility) =>
              field(
                t(`credit.facility.${facility}`),
                Math.round(editing.instalmentShares[facility] * 100),
                (next) =>
                  setDraft({
                    ...editing,
                    instalmentShares: { ...editing.instalmentShares, [facility]: next / 100 },
                  }),
                5,
              ),
            )}
          </div>
        </fieldset>

        {/* ── a change waiting for its second person ─────────────────────── */}
        {pending ? (
          <div className="flex flex-col gap-sm rounded-md border border-border bg-surface-variant px-md py-sm">
            <p className="text-body-small font-semibold text-text-primary">
              {t('rates.deduction.pendingTitle', {
                name: pending.proposedByName,
                when: formatDateTime(pending.proposedAt),
              })}
            </p>
            <p className="text-caption text-text-secondary">{pending.reason}</p>

            <ul className="flex flex-col gap-xxs">
              {deductionRateDiff(pending.current, pending.proposed).map((one) => (
                <li key={one.field} className="numeric text-caption text-text-primary">
                  {t(`rates.deduction.field.${one.field}`)}: {formatAmount(one.from)} →{' '}
                  {formatAmount(one.to)}
                </li>
              ))}
            </ul>

            {canApprove ? (
              <div className="flex flex-col gap-xs">
                <Field label={t('common.note')} hint={t('rates.deduction.noteHint')}>
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
                <div className="flex flex-wrap items-center gap-xs">
                  <Button
                    variant="primary"
                    disabled={wouldBeSelfApproval}
                    loading={decide.isPending}
                    iconLeft={<Check className="size-icon-sm" aria-hidden />}
                    onClick={() => void submitDecision('approve')}
                  >
                    {t('rates.deduction.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={note.trim().length < NOTE_MIN}
                    loading={decide.isPending}
                    iconLeft={<X className="size-icon-sm" aria-hidden />}
                    onClick={() => void submitDecision('reject')}
                  >
                    {t('rates.deduction.reject')}
                  </Button>
                </div>
                {wouldBeSelfApproval ? (
                  <p className="text-caption text-warning">{t('rates.deduction.fourEyes')}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-caption text-text-secondary">{t('rates.deduction.awaitingManager')}</p>
            )}
          </div>
        ) : canPropose ? (
          <div className="flex flex-col gap-xs border-t border-divider pt-md">
            <Field label={t('common.reason')} required hint={t('rates.deduction.reasonHint')}>
              {({ id, describedBy, required }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  required={required}
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-sm">
              <Button
                variant="primary"
                disabled={!dirty || reason.trim().length < NOTE_MIN}
                loading={propose.isPending}
                iconLeft={<Send className="size-icon-sm" aria-hidden />}
                onClick={() => void submitProposal()}
              >
                {t('rates.deduction.propose')}
              </Button>
              <p className="text-caption text-text-secondary">
                {dirty ? t('rates.deduction.needsApproval') : t('rates.deduction.nothingChanged')}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-caption text-text-secondary">{t('rates.deduction.readOnly')}</p>
        )}

        {/* The lines this screen does *not* set, and who does — so nobody looks for them. */}
        <p className="border-t border-divider pt-md text-caption text-text-secondary">
          {t('rates.deduction.elsewhere')}
        </p>
      </CardBody>
    </Card>
  );
}
