/**
 * Approve / reject, with the note that makes it defensible.
 *
 * Three rules from the spec are implemented here rather than assumed:
 *
 *  - **AC-06: rejecting without a note is impossible.** The button is disabled
 *    below ten characters, the schema refuses it, and the server answers
 *    `note-required`: three layers, because this note is what the supplier reads
 *    as the reason and an empty one guarantees a telephone call.
 *  - **BR-501: four eyes.** Self-approval is checked before the dialog opens, so
 *    a clerk who raised the request is told why rather than shown a form that
 *    will fail. The server still refuses it, because the console can be lied to.
 *  - **Approve and reject say different things.** The approve copy explains what
 *    the supplier will see; the reject copy reminds the clerk they are writing
 *    *to* the supplier. Same dialog, deliberately different words.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import type { AdminChangeRequest, ChangeRequestType } from '@tfd/domain';
import { isSelfApproval } from '@tfd/domain';
import { useCurrentUser } from '@/auth/authStore';
import { useNoteSuggestions } from '@/components/useNoteSuggestions';
import { DecisionNoteField, type NoteSuggestion } from '@/components/DecisionNoteField';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { errorMessageKey, errorReason, isBlockingError } from '@/lib/errorMessage';
import { isApiError } from '@/services/api/errors';
import { ChangeComparison } from './ChangeComparison';
import { useDecideChangeRequest, type DecisionVerb } from './hooks';

const MIN_NOTE = 10;

/**
 * The notes this queue writes all day, by change type and verb. The words live in the
 * string tables, only the choice and order are here.
 *
 * Per type, because a reason only helps when it fits: "Bring passbook" means nothing on
 * an address change, and nothing in this queue carries a photo to call unclear. Approving
 * and rejecting share no vocabulary, so the clerk is never shown a chip for the decision
 * they are not making.
 */
const SUGGESTIONS: Record<ChangeRequestType, Record<DecisionVerb, readonly string[]>> = {
  address: {
    approve: ['phone', 'collector', 'addressUpdated'],
    reject: ['addressIncomplete', 'outsideArea', 'notConfirmed'],
  },
  bankDetails: {
    approve: ['passbook', 'nameMatches', 'phone'],
    reject: ['mismatch', 'bringPassbook', 'notConfirmed'],
  },
  paymentMethod: {
    approve: ['nextPayout', 'bankOnFile', 'phone'],
    reject: ['noBankAccount', 'notConfirmed', 'visitOffice'],
  },
  savingsRate: {
    approve: ['nextMonth', 'phone'],
    reject: ['outstandingLoan', 'notConfirmed', 'visitOffice'],
  },
};
/** For a type this console does not know yet: the reasons that fit any change. */
const FALLBACK_SUGGESTIONS: Record<DecisionVerb, readonly string[]> = {
  approve: ['phone'],
  reject: ['notConfirmed', 'visitOffice'],
};

export function DecisionActions({ request }: { request: AdminChangeRequest }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const [verb, setVerb] = useState<DecisionVerb | null>(null);

  // Checked before offering the buttons. A clerk who raised the request on the
  // supplier's behalf cannot decide it, and being told that up front beats
  // filling in a note and being refused.
  const selfRaised = isSelfApproval(user, request.createdById);

  if (request.status !== 'pending') return null;

  if (selfRaised) {
    return (
      <Notice tone="warning">
        <span>
          <strong className="font-semibold">{t('changeRequests.fourEyes.title')}</strong>{' '}
          {t('changeRequests.fourEyes.body')}
        </span>
      </Notice>
    );
  }

  return (
    <>
      {/* Stacked and full width: this sits in the side column, and two equal buttons
          say the two answers are equally fine. */}
      <div className="flex flex-col gap-sm">
        <Button
          variant="primary"
          className="w-full"
          iconLeft={<Check className="size-icon-sm" aria-hidden />}
          onClick={() => setVerb('approve')}
        >
          {t('changeRequests.approve')}
        </Button>
        <Button
          variant="danger"
          className="w-full"
          iconLeft={<X className="size-icon-sm" aria-hidden />}
          onClick={() => setVerb('reject')}
        >
          {t('changeRequests.reject')}
        </Button>
      </div>

      {verb ? <DecisionDialog request={request} verb={verb} onClose={() => setVerb(null)} /> : null}
    </>
  );
}

function DecisionDialog({
  request,
  verb,
  onClose,
}: {
  request: AdminChangeRequest;
  verb: DecisionVerb;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [note, setNote] = useState('');
  const decide = useDecideChangeRequest(request.id, request.supplierId);

  const length = note.trim().length;
  const tooShort = length < MIN_NOTE;
  const approving = verb === 'approve';

  const slugs =
    SUGGESTIONS[request.type as ChangeRequestType]?.[verb] ?? FALLBACK_SUGGESTIONS[verb];
  const builtIn: NoteSuggestion[] = slugs.map((slug) => ({
    label: t(`changeRequests.noteSuggest.${verb}.${slug}`),
    text: t(`changeRequests.noteSuggest.${verb}.${slug}.text`),
  }));
  // The factory's own sentences when it has saved some (Configuration, Common notes).
  const suggestions = useNoteSuggestions(`changeRequests.${verb}` as const, builtIn);

  function submit() {
    decide.mutate(
      { verb, body: { note: note.trim() } },
      {
        onSuccess: () => {
          toast.success(approving ? t('changeRequests.approved') : t('changeRequests.rejected'));
          onClose();
        },
        // The dialog stays open on failure. Closing it would discard the note the
        // clerk just wrote, and a four-eyes or already-decided refusal is
        // something they need to read, not a toast that vanishes.
      },
    );
  }

  const blocking = isBlockingError(decide.error);
  const alreadyDecided = isApiError(decide.error) && decide.error.code === 'already-decided';
  // Not a mistake in the note: the API cannot apply a bank change yet, so trying again
  // cannot help. Explained in its own notice, with the button disabled.
  const bankNotReady = errorReason(decide.error) === 'bank-details-approval-not-implemented';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="md"
      title={
        <span className="flex items-center gap-sm">
          <span
            aria-hidden
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              approving ? 'bg-success-muted text-success' : 'bg-error-muted text-error',
            )}
          >
            {approving ? (
              <CheckCircle2 className="size-icon-md" />
            ) : (
              <XCircle className="size-icon-md" />
            )}
          </span>
          {approving ? t('changeRequests.approveTitle') : t('changeRequests.rejectTitle')}
        </span>
      }
      description={t('changeRequests.dialog.forSupplier', {
        type: t(`changeRequests.type.${request.type as ChangeRequestType}`),
        code: request.supplierCode,
        name: request.supplierName,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            loading={decide.isPending}
            disabled={tooShort || blocking || bankNotReady}
            onClick={submit}
          >
            {approving ? t('changeRequests.approve') : t('changeRequests.reject')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <ChangeComparison request={request} layout="list" />

        {/* What happens on the other side of the button, before it is pressed. */}
        <div
          className={cn(
            'flex items-start gap-sm rounded-md p-md text-body-small',
            approving ? 'bg-info-muted text-info' : 'bg-warning-muted text-warning',
          )}
        >
          {approving ? (
            <Info className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          )}
          <span>
            {approving ? t('changeRequests.approveBody') : t('changeRequests.rejectBody')}
          </span>
        </div>

        <DecisionNoteField
          label={t('changeRequests.noteLabel')}
          hint={t('changeRequests.noteHelp')}
          placeholder={
            approving
              ? t('changeRequests.notePlaceholderApprove')
              : t('changeRequests.notePlaceholderReject')
          }
          error={
            decide.error && !blocking && !bankNotReady
              ? t(errorMessageKey(decide.error))
              : undefined
          }
          value={note}
          onChange={setNote}
          suggestions={suggestions}
          suggestionsLabel={t('common.noteSuggestions')}
        />
        <p
          aria-live="polite"
          className={cn('-mt-sm text-caption', tooShort ? 'text-text-secondary' : 'text-success')}
        >
          {tooShort
            ? t('changeRequests.noteCount', { count: length, min: MIN_NOTE })
            : t('changeRequests.noteReady')}
        </p>

        {/* A blocking refusal gets its own explanation inside the dialog, never a
            toast; the clerk has to understand why nothing happened. */}
        {bankNotReady ? (
          <Notice tone="warning">
            <span>
              <strong className="font-semibold">{t('changeRequests.bankNotReady.title')}</strong>{' '}
              {t('changeRequests.bankNotReady.body')}
            </span>
          </Notice>
        ) : alreadyDecided ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('changeRequests.alreadyDecided.title')}</strong>{' '}
              {t('changeRequests.alreadyDecided.body')}
            </span>
          </Notice>
        ) : blocking ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('changeRequests.fourEyes.title')}</strong>{' '}
              {t('changeRequests.fourEyes.body')}
            </span>
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
