/**
 * Answer a supplier, or close the message unanswered.
 *
 * **Two verbs, one dialog, deliberately different copy.** Replying writes something
 * the supplier reads in the app; closing files a message that needed no answer — a
 * duplicate, a test, something meant for the weighing point. A single "resolve"
 * button with an optional note would make the two indistinguishable in the record,
 * and "how many did we actually answer" is the one number §19.3's channel-shift KPI
 * needs.
 *
 * There is **no four-eyes rule here**, and that is not an omission. BR-501 is about
 * money: nobody approves a payment they raised. Answering a question moves nothing,
 * and requiring a second clerk to release a reply would put a day between a
 * supplier's question and its answer to guard against a risk that does not exist.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Reply, X } from 'lucide-react';
import type { AdminInquiry } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey, isBlockingError } from '@/lib/errorMessage';
import { isAnswerable } from './answerable';
import { useAnswerInquiry, type InquiryVerb } from './hooks';

/** A reply is the answer, not a note about one — so it is held to a longer minimum. */
const MIN_REPLY = 20;
const MIN_CLOSURE_NOTE = 10;

export function InquiryActions({ inquiry }: { inquiry: AdminInquiry }) {
  const { t } = useTranslation();
  const [verb, setVerb] = useState<InquiryVerb | null>(null);
  /**
   * `inquiries: A` is what both endpoints require, and only the clerk role holds it; a
   * manager reads the queue (`R`) and an editor or administrator does not see it at all.
   * Buttons the server will refuse are not offered: the reader is told who answers instead.
   */
  const canAnswer = useCan('inquiries', 'approve');

  if (!isAnswerable(inquiry)) return null;

  if (!canAnswer) {
    return (
      <p className="flex items-start gap-sm rounded-md bg-surface-variant p-md text-body-small text-text-secondary">
        <Eye className="mt-xxs size-icon-sm shrink-0" aria-hidden />
        {t('inquiries.detail.readOnly')}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="primary"
          iconLeft={<Reply className="size-icon-sm" aria-hidden />}
          onClick={() => setVerb('reply')}
        >
          {t('inquiries.reply')}
        </Button>
        <Button
          variant="secondary"
          iconLeft={<X className="size-icon-sm" aria-hidden />}
          onClick={() => setVerb('close')}
        >
          {t('inquiries.close')}
        </Button>
      </div>

      {verb ? <ReplyDialog inquiry={inquiry} verb={verb} onClose={() => setVerb(null)} /> : null}
    </>
  );
}

function ReplyDialog({
  inquiry,
  verb,
  onClose,
}: {
  inquiry: AdminInquiry;
  verb: InquiryVerb;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [text, setText] = useState('');
  const answer = useAnswerInquiry(inquiry.id);

  const replying = verb === 'reply';
  const minimum = replying ? MIN_REPLY : MIN_CLOSURE_NOTE;
  const tooShort = text.trim().length < minimum;

  function submit() {
    const trimmed = text.trim();
    answer.mutate(
      replying
        ? { verb: 'reply', body: { body: trimmed } }
        : { verb: 'close', body: { note: trimmed } },
      {
        onSuccess: () => {
          toast.success(replying ? t('inquiries.replied') : t('inquiries.closed'));
          onClose();
        },
        // Stays open on failure — a reply is often several sentences, and closing
        // the dialog would discard them.
      },
    );
  }

  const blocking = isBlockingError(answer.error);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={replying ? t('inquiries.replyTitle') : t('inquiries.closeTitle')}
      description={replying ? t('inquiries.replyBody') : t('inquiries.closeBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={replying ? 'primary' : 'danger'}
            loading={answer.isPending}
            disabled={tooShort || blocking}
            onClick={submit}
          >
            {replying ? t('inquiries.sendReply') : t('inquiries.close')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {/* What was asked, in front of the person answering it. Writing a reply
            from memory of the previous screen is how a supplier gets an answer to
            somebody else's question. */}
        <div className="rounded-md bg-surface-variant p-md">
          <p className="text-overline text-text-secondary uppercase">{inquiry.subject}</p>
          <p className="mt-xxs text-body-small whitespace-pre-line text-text-primary">
            {/* In a conversation, the latest thing the supplier said is what is being
                answered, not the question that opened it. */}
            {[...(inquiry.messages ?? [])].reverse().find((one) => one.author === 'supplier')
              ?.body ?? inquiry.message}
          </p>
        </div>

        <Field
          label={replying ? t('inquiries.replyLabel') : t('inquiries.closureNoteLabel')}
          required
          hint={replying ? t('inquiries.replyHelp') : t('inquiries.closureNoteHelp')}
          error={answer.error && !blocking ? t(errorMessageKey(answer.error)) : undefined}
        >
          {({ id, describedBy, invalid, required }) => (
            <Textarea
              id={id}
              autoFocus
              rows={replying ? 6 : 3}
              value={text}
              placeholder={
                replying ? t('inquiries.replyPlaceholder') : t('inquiries.closurePlaceholder')
              }
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </Field>

        {blocking ? (
          <Notice tone="error">
            <span>
              <strong className="font-semibold">{t('inquiries.alreadyAnswered.title')}</strong>{' '}
              {t('inquiries.alreadyAnswered.body')}
            </span>
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
