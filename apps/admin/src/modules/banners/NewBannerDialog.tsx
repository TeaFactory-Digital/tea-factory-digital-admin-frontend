/**
 * Creating a banner.
 *
 * Narrowed the same way `NewArticleDialog` is — **the fallback language only** — because
 * nobody writes a banner in three languages in one sitting, and a form that implied they
 * should is a form abandoned half-filled. The translations follow on the editor screen,
 * often from a different person on a different day.
 *
 * What this dialog asks for beyond the copy is the two things a banner cannot exist
 * without and an article has no equivalent of: **where the button goes**, and **when it
 * runs**. Neither can be deferred to the editor screen the way artwork can — a banner
 * with no action is not a draft of anything, and a banner with no window has no answer to
 * "is this live", which is the question the whole module is organised around.
 *
 * It always creates a **draft**. Publishing needs `content: approve`, which §12.1
 * withholds from the editor who writes — the same boundary M11 draws.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BannerAction } from '@tfd/domain';
import { EDITORIAL_FALLBACK_LANGUAGE, bannerActionProblem } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { BannerActionField } from './BannerActionField';
import { useCreateBanner } from './hooks';

/** Today, as the `datetime-local` inputs want it. Seconds dropped — nobody schedules those. */
function localNow(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function NewBannerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateBanner();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [action, setAction] = useState<BannerAction>({ type: 'screen', path: '' });
  const [startsAt, setStartsAt] = useState(localNow());
  const [endsAt, setEndsAt] = useState('');

  // Cleared on open, not on close: a dialog holding the last banner's text invites an
  // editor to publish something they only half-rewrote.
  useEffect(() => {
    if (open) {
      setTitle('');
      setBody('');
      setButtonLabel('');
      setAction({ type: 'screen', path: '' });
      setStartsAt(localNow());
      setEndsAt('');
    }
  }, [open]);

  const actionProblem = bannerActionProblem(action);
  /**
   * An empty `endsAt` is **"until it is taken down"**, not a validation failure. That is
   * a real and common intention — a banner about opening hours runs until the hours
   * change — and forcing a date would make the office invent one.
   */
  const windowBackwards = endsAt !== '' && endsAt < startsAt;

  const complete =
    title.trim().length > 0 &&
    buttonLabel.trim().length > 0 &&
    startsAt !== '' &&
    !actionProblem &&
    !windowBackwards;

  async function submit() {
    try {
      const banner = await create.mutateAsync({
        translations: [
          {
            lang: EDITORIAL_FALLBACK_LANGUAGE,
            title: title.trim(),
            body: body.trim() || undefined,
            buttonLabel: buttonLabel.trim(),
          },
        ],
        action,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
      toast.success(t('banners.created'), t('banners.createdHint'));
      onClose();
      // Straight into the editor: the next thing the office does is translate it and add
      // artwork, and making them find the row they just created is a wasted step.
      onCreated(banner.id);
    } catch (cause) {
      toast.error(t('banners.createFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title={t('banners.createTitle')}
      description={t('banners.createDescription', {
        language: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
      })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!complete} loading={create.isPending} onClick={() => void submit()}>
            {t('banners.createConfirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Field label={t('banners.field.headline')} required>
          {({ id, describedBy, required }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              required={required}
              autoFocus
              lang={EDITORIAL_FALLBACK_LANGUAGE}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>

        <Field label={t('banners.field.body')} hint={t('banners.field.bodyHint')}>
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={2}
              lang={EDITORIAL_FALLBACK_LANGUAGE}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          )}
        </Field>

        <Field label={t('banners.field.buttonLabel')} required hint={t('banners.field.buttonHint')}>
          {({ id, describedBy, required }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              required={required}
              lang={EDITORIAL_FALLBACK_LANGUAGE}
              value={buttonLabel}
              onChange={(event) => setButtonLabel(event.target.value)}
            />
          )}
        </Field>

        <BannerActionField value={action} onChange={setAction} />

        <div className="grid gap-sm sm:grid-cols-2">
          <Field label={t('banners.field.startsAt')} required>
            {({ id, describedBy, required }) => (
              <Input
                id={id}
                type="datetime-local"
                aria-describedby={describedBy}
                required={required}
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            )}
          </Field>

          <Field
            label={t('banners.field.endsAt')}
            hint={t('banners.field.endsAtHint')}
            error={windowBackwards ? t('banners.window.backwards') : undefined}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="datetime-local"
                aria-describedby={describedBy}
                invalid={invalid}
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            )}
          </Field>
        </div>

        <p className="text-caption text-text-secondary">{t('banners.createDraftHint')}</p>
      </div>
    </Dialog>
  );
}
