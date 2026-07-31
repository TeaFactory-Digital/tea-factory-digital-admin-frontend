/**
 * Approve / reject, with the note that makes it defensible.
 *
 * Three rules from the spec are implemented here rather than assumed:
 *
 *  - **AC-06: rejecting without a note is impossible.** The button is disabled
 *    below ten characters, the schema refuses it, and the server answers
 *    `note-required` — three layers, because this note is what the supplier reads
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
import { Check, X } from 'lucide-react';
import type { AdminChangeRequest } from '@tfd/domain';
import { isSelfApproval } from '@tfd/domain';
import { useCurrentUser } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey, isBlockingError } from '@/lib/errorMessage';
import { isApiError } from '@/services/api/errors';
import { useDecideChangeRequest, type DecisionVerb } from './hooks';

const MIN_NOTE = 10;

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
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="primary"
          iconLeft={<Check className="size-icon-sm" aria-hidden />}
          onClick={() => setVerb('approve')}
        >
          {t('changeRequests.approve')}
        </Button>
        <Button
          variant="danger"
          iconLeft={<X className="size-icon-sm" aria-hidden />}
          onClick={() => setVerb('reject')}
        >
          {t('changeRequests.reject')}
        </Button>
      </div>

      {verb ? (
        <DecisionDialog request={request} verb={verb} onClose={() => setVerb(null)} />
      ) : null}
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

  const tooShort = note.trim().length < MIN_NOTE;
  const approving = verb === 'approve';

  function submit() {
    decide.mutate(
      { verb, body: { note: note.trim() } },
      {
        onSuccess: () => {
          toast.success(
            approving ? t('changeRequests.approved') : t('changeRequests.rejected'),
          );
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

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={approving ? t('changeRequests.approveTitle') : t('changeRequests.rejectTitle')}
      description={approving ? t('changeRequests.approveBody') : t('changeRequests.rejectBody')}
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
            {approving ? t('changeRequests.approve') : t('changeRequests.reject')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <div className="grid gap-sm sm:grid-cols-2">
          <div className="rounded-md bg-surface-variant p-md">
            <p className="text-overline text-text-secondary uppercase">
              {t('changeRequests.detail.currentHeading')}
            </p>
            <p className="mt-xxs text-body-small text-text-primary">{request.currentSummary}</p>
          </div>
          <div className="rounded-md bg-primary-muted p-md">
            <p className="text-overline text-primary uppercase">
              {t('changeRequests.detail.requestedHeading')}
            </p>
            <p className="mt-xxs text-body-small font-medium text-text-primary">
              {request.requestedSummary}
            </p>
          </div>
        </div>

        <Field
          label={t('changeRequests.noteLabel')}
          required
          hint={t('changeRequests.noteHelp')}
          error={
            decide.error && !blocking ? t(errorMessageKey(decide.error)) : undefined
          }
        >
          {({ id, describedBy, invalid, required }) => (
            <Textarea
              id={id}
              autoFocus
              value={note}
              placeholder={
                approving
                  ? t('changeRequests.notePlaceholderApprove')
                  : t('changeRequests.notePlaceholderReject')
              }
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>

        {/* A blocking refusal gets its own explanation inside the dialog, never a
            toast — the clerk has to understand why nothing happened. */}
        {alreadyDecided ? (
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
              {t('changeRequests.fourEyes.body')}
            </span>
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
