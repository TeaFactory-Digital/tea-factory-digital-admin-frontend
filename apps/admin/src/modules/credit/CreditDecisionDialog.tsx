/**
 * Approve / reject a credit request.
 *
 * Structurally M9's dialog, with the two rules money adds:
 *
 *  - **BR-310: the ceiling travels with the decision.** `ceilingSeen` is the figure
 *    on screen when the button was pressed. The server recomputes and refuses with
 *    `stale-eligibility` if it has moved — because the approver agreed to a
 *    specific number, and silently substituting a different one is the worst
 *    available outcome: nobody finds out.
 *  - **`over-ceiling` is checked here first.** Not to replace the server's refusal,
 *    but so the button that would move money is disabled rather than clickable-and-
 *    refused. A control that fails after the click teaches the office to click it.
 *
 * Approving is withheld entirely when the request is over the ceiling. The clerk's
 * options are then reject, or send the supplier back to raise a smaller one — and
 * saying so is more useful than a form that cannot succeed. §21.6's manager
 * threshold, when the factory sets one, becomes a third path here rather than a
 * change to any of this: `canApproveAmount` already treats "not configured" as
 * "the base capability suffices".
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import type { AdminCreditRequest } from '@tfd/domain';
import { isSelfApproval } from '@tfd/domain';
import { useCan, useCurrentUser } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey, isBlockingError } from '@/lib/errorMessage';
import { formatAmount } from '@/lib/format';
import { isApiError } from '@/services/api/errors';
import { useDecideCreditRequest, type CreditVerb } from './hooks';

const MIN_NOTE = 10;

export function CreditDecisionActions({ request }: { request: AdminCreditRequest }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const mayDecide = useCan('creditRequests', 'approve');
  const [verb, setVerb] = useState<CreditVerb | null>(null);

  const selfRaised = isSelfApproval(user, request.createdById);
  const overCeiling = request.amount > request.eligibility.available;

  if (request.status !== 'pending') return null;

  /**
   * Checked here, unlike M9's dialog, because on this queue read and decide are
   * **different roles**. §12.1 gives `creditRequests: R` to the clerk and the
   * accountant and `A` to the manager alone — so most of the people who open this
   * screen cannot act on it, and showing them buttons that will 403 is the lever
   * the rbac module exists to hide. Saying who *can* is more use than saying no.
   */
  if (!mayDecide) {
    return (
      <Notice tone="info">
        <span>{t('credit.managerDecides')}</span>
      </Notice>
    );
  }

  if (selfRaised) {
    return (
      <Notice tone="warning">
        <span>
          <strong className="font-semibold">{t('changeRequests.fourEyes.title')}</strong>{' '}
          {t('credit.fourEyes.body')}
        </span>
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      {/* Said before the buttons, not after a failed click. */}
      {overCeiling ? (
        <Notice tone="error">
          <span>
            <strong className="font-semibold">{t('credit.overCeiling.title')}</strong>{' '}
            {t('credit.overCeiling.body', {
              amount: formatAmount(request.amount),
              available: formatAmount(request.eligibility.available),
            })}
          </span>
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-sm">
        {/**
         * Withheld rather than disabled when the ask is over the ceiling.
         *
         * A disabled Approve invites "why?" and a hover title nobody reads. The
         * banner above already says why, and the action that *is* available stays
         * where the eye expects it.
         */}
        {overCeiling ? null : (
          <Button
            variant="primary"
            iconLeft={<Check className="size-icon-sm" aria-hidden />}
            onClick={() => setVerb('approve')}
          >
            {t('credit.approve')}
          </Button>
        )}
        <Button
          variant="danger"
          iconLeft={<X className="size-icon-sm" aria-hidden />}
          onClick={() => setVerb('reject')}
        >
          {t('credit.reject')}
        </Button>
      </div>

      {verb ? (
        <CreditDecisionDialog request={request} verb={verb} onClose={() => setVerb(null)} />
      ) : null}
    </div>
  );
}

function CreditDecisionDialog({
  request,
  verb,
  onClose,
}: {
  request: AdminCreditRequest;
  verb: CreditVerb;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [note, setNote] = useState('');
  const decide = useDecideCreditRequest(request.id, request.supplierId);

  const tooShort = note.trim().length < MIN_NOTE;
  const approving = verb === 'approve';

  function submit() {
    decide.mutate(
      {
        verb,
        body: {
          note: note.trim(),
          // The figure on screen, not one read back from the cache at submit time.
          ceilingSeen: request.eligibility.ceiling,
        },
        check: { amount: request.amount, available: request.eligibility.available },
      },
      {
        onSuccess: () => {
          toast.success(approving ? t('credit.approved') : t('credit.rejected'));
          onClose();
        },
        // Stays open on failure: the note is worth keeping, and every refusal this
        // dialog can meet is one the clerk has to read.
      },
    );
  }

  const blocking = isBlockingError(decide.error);
  const code = isApiError(decide.error) ? decide.error.code : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={approving ? t('credit.approveTitle') : t('credit.rejectTitle')}
      description={
        approving
          ? t('credit.approveBody', {
              amount: formatAmount(request.amount),
              facility: t(`credit.facility.${request.facility}`).toLowerCase(),
            })
          : t('credit.rejectBody')
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            loading={decide.isPending}
            disabled={tooShort || blocking}
            onClick={submit}
          >
            {approving ? t('credit.approve') : t('credit.reject')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {/* The three figures the decision turns on, restated inside the dialog so
            the approver is not deciding from memory of the panel behind it. */}
        <dl className="grid grid-cols-3 gap-sm rounded-md bg-surface-variant p-md">
          <div>
            <dt className="text-overline text-text-secondary uppercase">{t('credit.requested')}</dt>
            <dd className="numeric text-body-small font-semibold text-text-primary">
              {formatAmount(request.amount)}
            </dd>
          </div>
          <div>
            <dt className="text-overline text-text-secondary uppercase">
              {t('credit.eligibility.ceiling')}
            </dt>
            <dd className="numeric text-body-small text-text-primary">
              {formatAmount(request.eligibility.ceiling)}
            </dd>
          </div>
          <div>
            <dt className="text-overline text-text-secondary uppercase">
              {t('credit.eligibility.available')}
            </dt>
            <dd className="numeric text-body-small text-text-primary">
              {formatAmount(request.eligibility.available)}
            </dd>
          </div>
        </dl>

        <Field
          label={t('credit.noteLabel')}
          required
          hint={t('credit.noteHelp')}
          error={decide.error && !blocking ? t(errorMessageKey(decide.error)) : undefined}
        >
          {({ id, describedBy, invalid, required }) => (
            <Textarea
              id={id}
              autoFocus
              value={note}
              placeholder={
                approving ? t('credit.notePlaceholderApprove') : t('credit.notePlaceholderReject')
              }
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>

        {/**
         * Each blocking refusal gets its own words. They are not interchangeable:
         * one means reload, one means hand it to a colleague, one means this row
         * can never be approved as it stands.
         */}
        {code === 'stale-eligibility' ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('credit.stale.title')}</strong>{' '}
              {t('credit.stale.body')}
            </span>
          </Notice>
        ) : code === 'over-ceiling' ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('credit.overCeiling.title')}</strong>{' '}
              {t('credit.overCeiling.body', {
                amount: formatAmount(request.amount),
                available: formatAmount(request.eligibility.available),
              })}
            </span>
          </Notice>
        ) : code === 'already-decided' ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">
                {t('changeRequests.alreadyDecided.title')}
              </strong>{' '}
              {t('changeRequests.alreadyDecided.body')}
            </span>
          </Notice>
        ) : blocking ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('changeRequests.fourEyes.title')}</strong>{' '}
              {t('credit.fourEyes.body')}
            </span>
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
