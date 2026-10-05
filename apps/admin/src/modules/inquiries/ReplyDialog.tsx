/**
 * Answer a supplier, or close the message unanswered.
 *
 * **The answer is written in the conversation, not in a dialog.** The box sits under the
 * last message, as in any chat, so the clerk writes with the whole thread above it, and
 * the sentences the office sends all day are offered as chips that fill the box (and
 * stay editable). Closing stays a dialog: it ends the conversation, takes a reason only
 * the office reads, and should take a deliberate second step.
 *
 * **Two verbs, deliberately different.** Replying writes something the supplier reads in
 * the app; closing files a message that needed no answer (a duplicate, a test, something
 * meant for the weighing point). "How many did we actually answer" is the one number the
 * channel-shift KPI needs, so the two stay distinguishable in the record.
 *
 * There is **no four-eyes rule here**, and that is not an omission. BR-501 is about
 * money: nobody approves a payment they raised. Answering a question moves nothing.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Send, X } from 'lucide-react';
import type { AdminInquiry } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { useNoteSuggestions } from '@/components/useNoteSuggestions';
import { DecisionNoteField, type NoteSuggestion } from '@/components/DecisionNoteField';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { errorMessageKey, isBlockingError } from '@/lib/errorMessage';
import { isAnswerable } from './answerable';
import { useAnswerInquiry } from './hooks';

/** A reply is the answer, not a note about one, so it is held to a longer minimum. */
const MIN_REPLY = 20;
const MIN_CLOSURE_NOTE = 10;

/** The answers this queue writes all day. Words in the string tables, order here. */
const REPLY_SUGGESTIONS = ['received', 'checking', 'visitOffice', 'callOffice', 'sorted'] as const;

export function InquiryActions({ inquiry }: { inquiry: AdminInquiry }) {
  const { t } = useTranslation();
  /**
   * `inquiries: A` is what both endpoints require, and only the clerk role holds it; a
   * manager reads the queue (`R`) and an editor or administrator does not see it at all.
   * Controls the server will refuse are not offered: the reader is told who answers instead.
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

  return <ReplyComposer inquiry={inquiry} />;
}

/** The reply box under the conversation, with the office's common answers as chips. */
function ReplyComposer({ inquiry }: { inquiry: AdminInquiry }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [text, setText] = useState('');
  const [closing, setClosing] = useState(false);
  const answer = useAnswerInquiry(inquiry.id);

  const length = text.trim().length;
  const tooShort = length < MIN_REPLY;
  const blocking = isBlockingError(answer.error);

  const builtIn: NoteSuggestion[] = REPLY_SUGGESTIONS.map((slug) => ({
    label: t(`inquiries.suggest.${slug}`),
    text: t(`inquiries.suggest.${slug}.text`),
  }));
  // The factory's own sentences when it has saved some (Configuration, Common notes).
  const suggestions = useNoteSuggestions('inquiries.reply', builtIn);

  function send() {
    answer.mutate(
      { verb: 'reply', body: { body: text.trim() } },
      {
        onSuccess: () => {
          toast.success(t('inquiries.replied'));
          setText('');
        },
        // On failure the text stays: a reply is often several sentences.
      },
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      <DecisionNoteField
        label={t('inquiries.replyLabel')}
        hint={t('inquiries.replyHelp')}
        placeholder={t('inquiries.replyPlaceholder')}
        error={answer.error && !blocking ? t(errorMessageKey(answer.error)) : undefined}
        value={text}
        onChange={setText}
        suggestions={suggestions}
        suggestionsLabel={t('common.noteSuggestions')}
        autoFocus={false}
      />

      {blocking ? (
        <Notice tone="error">
          <span>
            <strong className="font-semibold">{t('inquiries.alreadyAnswered.title')}</strong>{' '}
            {t('inquiries.alreadyAnswered.body')}
          </span>
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-sm">
        <Button
          variant="ghost"
          iconLeft={<X className="size-icon-sm" aria-hidden />}
          onClick={() => setClosing(true)}
        >
          {t('inquiries.close')}
        </Button>
        <div className="flex items-center gap-md">
          <span
            aria-live="polite"
            className={cn('text-caption', tooShort ? 'text-text-secondary' : 'text-success')}
          >
            {tooShort
              ? t('inquiries.replyCount', { count: length, min: MIN_REPLY })
              : t('changeRequests.noteReady')}
          </span>
          <Button
            variant="primary"
            iconLeft={<Send className="size-icon-sm" aria-hidden />}
            loading={answer.isPending}
            disabled={tooShort || blocking}
            onClick={send}
          >
            {t('inquiries.sendReply')}
          </Button>
        </div>
      </div>

      {closing ? <CloseDialog inquiry={inquiry} onClose={() => setClosing(false)} /> : null}
    </div>
  );
}

/** Close unanswered: a reason the office keeps, never sent to the supplier. */
function CloseDialog({ inquiry, onClose }: { inquiry: AdminInquiry; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [text, setText] = useState('');
  const answer = useAnswerInquiry(inquiry.id);
  const tooShort = text.trim().length < MIN_CLOSURE_NOTE;
  const blocking = isBlockingError(answer.error);

  function submit() {
    answer.mutate(
      { verb: 'close', body: { note: text.trim() } },
      {
        onSuccess: () => {
          toast.success(t('inquiries.closed'));
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('inquiries.closeTitle')}
      description={t('inquiries.closeBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={answer.isPending}
            disabled={tooShort || blocking}
            onClick={submit}
          >
            {t('inquiries.close')}
          </Button>
        </>
      }
    >
      <Field
        label={t('inquiries.closureNoteLabel')}
        required
        hint={t('inquiries.closureNoteHelp')}
        error={answer.error && !blocking ? t(errorMessageKey(answer.error)) : undefined}
      >
        {({ id, describedBy, invalid, required }) => (
          <Textarea
            id={id}
            autoFocus
            rows={3}
            value={text}
            placeholder={t('inquiries.closurePlaceholder')}
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            onChange={(event) => setText(event.target.value)}
          />
        )}
      </Field>
    </Dialog>
  );
}
