/**
 * Approve or reject a tea-packet request.
 *
 * One dialog with both verbs rather than two entry points, because unlike M9 the clerk
 * has not decided which one they are doing before they open it: the row shows a packet
 * count and a price, and *reading the request* is what settles it. M9's queue puts
 * current-vs-requested in the grid, so the decision is usually made before the dialog
 * opens; here the note and the choice are made in the same place.
 *
 * The rules that carry over unchanged, because they are not about credit:
 *
 *  - **AC-06** — a decision without a note is impossible. Disabled under ten
 *    characters, refused by the schema, refused by the server.
 *  - **BR-501** — the four-eyes check is on the *row*, before this opens, and the
 *    server refuses regardless because the console can be lied to.
 *
 * What is deliberately absent is BR-310's staleness check. There is no ceiling here to
 * move, so there is nothing for an approver to have agreed to that could quietly change
 * underneath them — see `AdminTeaPacketRequest`.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminTeaPacketRequest, TeaPacketPolicy } from '@tfd/domain';
import { teaPacketRequestProblems, teaPacketWeightKg } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey, isBlockingError } from '@/lib/errorMessage';
import { isApiError } from '@/services/api/errors';
import { formatAmount } from '@/lib/format';
import { useDecideTeaPacketRequest, type DecisionVerb } from './hooks';

const MIN_NOTE = 10;

export function TeaPacketDecisionDialog({
  request,
  policy,
  onClose,
}: {
  request: AdminTeaPacketRequest;
  policy: TeaPacketPolicy;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [note, setNote] = useState('');
  const decide = useDecideTeaPacketRequest(request.id, request.supplierId);

  const tooShort = note.trim().length < MIN_NOTE;

  /**
   * What is wrong with the request as asked — the store's own limits, not the
   * supplier's creditworthiness.
   *
   * Shown rather than enforced on the approve button, and that asymmetry is the point:
   * a request over the per-request cap is a **reason to reject with a sentence the
   * supplier can act on** ("we can issue five at a time"), not a control the office is
   * locked out of. The server refuses the approval either way; this is what lets the
   * clerk write the useful note instead of discovering the refusal afterwards.
   */
  const problems = teaPacketRequestProblems(policy, request.packets);

  const blocking = isBlockingError(decide.error);
  const alreadyDecided = isApiError(decide.error) && decide.error.code === 'already-decided';

  function submit(verb: DecisionVerb) {
    decide.mutate(
      { verb, body: { note: note.trim() } },
      {
        onSuccess: () => {
          toast.success(
            verb === 'approve' ? t('teaPackets.approved') : t('teaPackets.rejected'),
          );
          onClose();
        },
        // Stays open on failure: closing would discard the note just written, and an
        // already-decided or four-eyes refusal is something to read, not a toast.
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('teaPackets.decideTitle')}
      description={t('teaPackets.decideBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={decide.isPending}
            disabled={tooShort || blocking}
            onClick={() => submit('reject')}
          >
            {t('teaPackets.reject')}
          </Button>
          <Button
            variant="primary"
            loading={decide.isPending}
            disabled={tooShort || blocking || problems.length > 0}
            onClick={() => submit('approve')}
          >
            {t('teaPackets.approve')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <div className="grid gap-sm sm:grid-cols-2">
          <div className="rounded-md bg-surface-variant p-md">
            <p className="text-overline text-text-secondary uppercase">
              {t('teaPackets.column.supplier')}
            </p>
            <p className="numeric mt-xxs text-body-small font-semibold text-text-primary">
              {request.supplierCode}
            </p>
            <p className="text-caption text-text-secondary">{request.supplierName}</p>
          </div>
          <div className="rounded-md bg-primary-muted p-md">
            <p className="text-overline text-primary uppercase">{t('teaPackets.request')}</p>
            <p className="numeric mt-xxs text-body-small font-medium text-text-primary">
              {t('teaPackets.packetsWithWeight', {
                packets: request.packets,
                kg: teaPacketWeightKg(policy, request.packets),
              })}
            </p>
            <p className="text-caption text-text-secondary">
              {t(`teaPackets.delivery.${request.deliveryMethod}`)} ·{' '}
              {formatAmount(request.amount)}
            </p>
          </div>
        </div>

        {/* The supplier's own words. Short, and often the whole reason the request
            makes sense — "for my daughter's wedding" is not something to guess at. */}
        {request.notes ? (
          <div className="rounded-md border border-divider p-md">
            <p className="text-overline text-text-secondary uppercase">
              {t('teaPackets.supplierNote')}
            </p>
            <p className="mt-xxs text-body-small text-text-primary">{request.notes}</p>
          </div>
        ) : null}

        {problems.length > 0 ? (
          <Notice tone="warning">
            <span>
              <strong className="font-semibold">{t('teaPackets.problem.title')}</strong>{' '}
              {problems
                .map((problem) =>
                  t(`teaPackets.problem.${problem}`, { max: policy.maxPacketsPerRequest }),
                )
                .join(' ')}
            </span>
          </Notice>
        ) : null}

        <Field
          label={t('teaPackets.noteLabel')}
          required
          hint={t('teaPackets.noteHelp')}
          error={decide.error && !blocking ? t(errorMessageKey(decide.error)) : undefined}
        >
          {({ id, describedBy, invalid, required }) => (
            <Textarea
              id={id}
              autoFocus
              value={note}
              placeholder={t('teaPackets.notePlaceholder')}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>

        {alreadyDecided ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('teaPackets.alreadyDecided.title')}</strong>{' '}
              {t('teaPackets.alreadyDecided.body')}
            </span>
          </Notice>
        ) : blocking ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('teaPackets.fourEyes.title')}</strong>{' '}
              {t('teaPackets.fourEyes.body')}
            </span>
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
