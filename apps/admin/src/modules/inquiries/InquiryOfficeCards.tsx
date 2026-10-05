/**
 * The office's own side of an inquiry (BACKEND-TODO #35): who is handling it, and notes
 * the office keeps for itself. **The supplier never sees either.**
 *
 * Assignment is only ever to oneself ("Assign to me") or to nobody: picking a colleague
 * would need the list of console users, which a clerk is not allowed to read, and "I have
 * this one" is what the counter actually says.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, StickyNote, UserCheck, UserMinus } from 'lucide-react';
import type { AdminInquiry } from '@tfd/domain';
import { useCan, useCurrentUser } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useAddInquiryNote, useAssignInquiry } from './hooks';

export function InquiryAssignmentCard({ inquiry }: { inquiry: AdminInquiry }) {
  const { t } = useTranslation();
  const toast = useToast();
  const user = useCurrentUser();
  const canAnswer = useCan('inquiries', 'approve');
  const assign = useAssignInquiry(inquiry.id);
  const mine = inquiry.assignedToId != null && inquiry.assignedToId === user?.id;
  const open = inquiry.status !== 'closed';

  const run = (assignToMe: boolean) =>
    assign.mutate(assignToMe, {
      onSuccess: () =>
        toast.success(assignToMe ? t('inquiries.assign.taken') : t('inquiries.assign.released')),
      onError: (cause) => toast.error(t('inquiries.assign.failed'), t(errorMessageKey(cause))),
    });

  return (
    <Card>
      <CardHeader title={t('inquiries.assign.title')} />
      <CardBody className="flex flex-col gap-md">
        <p className="flex items-center gap-sm text-body-small text-text-primary">
          <UserCheck className="size-icon-sm text-text-secondary" aria-hidden />
          {inquiry.assignedToName
            ? mine
              ? t('inquiries.assign.you')
              : inquiry.assignedToName
            : t('inquiries.assign.nobody')}
        </p>
        {canAnswer && open ? (
          mine ? (
            <Button
              size="sm"
              variant="secondary"
              loading={assign.isPending}
              iconLeft={<UserMinus className="size-icon-sm" aria-hidden />}
              onClick={() => run(false)}
            >
              {t('inquiries.assign.release')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              loading={assign.isPending}
              iconLeft={<UserCheck className="size-icon-sm" aria-hidden />}
              onClick={() => run(true)}
            >
              {inquiry.assignedToName ? t('inquiries.assign.takeOver') : t('inquiries.assign.take')}
            </Button>
          )
        ) : null}
      </CardBody>
    </Card>
  );
}

export function InquiryNotesCard({ inquiry }: { inquiry: AdminInquiry }) {
  const { t } = useTranslation();
  const toast = useToast();
  const addNote = useAddInquiryNote(inquiry.id);
  const [draft, setDraft] = useState('');
  const notes = inquiry.notes ?? [];

  function save() {
    addNote.mutate(draft, {
      onSuccess: () => setDraft(''),
      onError: (cause) => toast.error(t('inquiries.notes.failed'), t(errorMessageKey(cause))),
    });
  }

  return (
    <Card>
      <CardHeader
        title={t('inquiries.notes.title')}
        description={
          <span className="flex items-center gap-xs">
            <Lock className="size-icon-xs" aria-hidden />
            {t('inquiries.notes.hint')}
          </span>
        }
      />
      <CardBody className="flex flex-col gap-md">
        {notes.length === 0 ? (
          <p className="text-body-small text-text-secondary">{t('inquiries.notes.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-md border border-dashed border-border bg-warning-muted/40 p-sm"
              >
                <p className="text-body-small whitespace-pre-line text-text-primary">{note.body}</p>
                <p className="mt-xxs flex items-center gap-xs text-caption text-text-secondary">
                  <StickyNote className="size-icon-xs" aria-hidden />
                  {note.authorName} · {formatDateTime(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          rows={2}
          value={draft}
          placeholder={t('inquiries.notes.placeholder')}
          aria-label={t('inquiries.notes.add')}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          size="sm"
          variant="secondary"
          className="self-end"
          loading={addNote.isPending}
          disabled={draft.trim().length < 2}
          onClick={save}
        >
          {t('inquiries.notes.add')}
        </Button>
      </CardBody>
    </Card>
  );
}
