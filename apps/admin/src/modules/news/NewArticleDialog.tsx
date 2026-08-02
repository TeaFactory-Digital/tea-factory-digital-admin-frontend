/**
 * Creating an article.
 *
 * **Only the fallback language, and that is a deliberate narrowing.** The dialog could
 * offer all three tabs, and it would be the wrong shape: nobody writes a circular in
 * three languages in one sitting, and a form that implied they should is a form abandoned
 * half-filled. What actually happens is that the English goes in now and the translations
 * follow — often by different people, sometimes days later — which is exactly what the
 * per-language editor on the next screen is for.
 *
 * So this asks for the one thing a record cannot exist without. The fallback copy is
 * required because a record with nothing to fall back to cannot be shown to anybody
 * (AC-08), and creating one would only defer the error onto whoever tried to publish it.
 *
 * It always creates a **draft**. There is no "create and publish": publishing needs
 * `content: approve`, which §12.1 withholds from the editor who writes.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EDITORIAL_FALLBACK_LANGUAGE } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { useCreateNewsArticle } from '@/modules/content/hooks';

export function NewArticleDialog({
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
  const create = useCreateNewsArticle();

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [confirmingCreate, setConfirmingCreate] = useState(false);

  // Cleared on open, not on close: a dialog that kept the last article's text would
  // invite an editor to publish a circular they only half-rewrote.
  useEffect(() => {
    if (open) {
      setTitle('');
      setExcerpt('');
      setBody('');
    }
  }, [open]);

  const complete = title.trim().length > 0 && body.trim().length > 0;

  async function submit() {
    setConfirmingCreate(true);
  }

  async function confirmCreate() {
    try {
      const article = await create.mutateAsync({
        translations: [
          {
            lang: EDITORIAL_FALLBACK_LANGUAGE,
            title,
            excerpt: excerpt || undefined,
            body,
          },
        ],
      });
      setConfirmingCreate(false);
      toast.success(t('news.created'), t('news.createdHint'));
      onClose();
      // Straight into the editor: the next thing the office does is translate it, and
      // making them find the row they just created in a 25-row grid is a wasted step.
      onCreated(article.id);
    } catch (cause) {
      toast.error(t('news.createFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        size="md"
        title={t('news.createTitle')}
        description={t('news.createDescription', {
          language: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
        })}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!complete} loading={create.isPending} onClick={() => void submit()}>
              {t('news.createConfirm')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          <Field label={t('content.field.title')} required>
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

          <Field label={t('content.field.excerpt')} hint={t('content.field.excerptHint')}>
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                rows={2}
                lang={EDITORIAL_FALLBACK_LANGUAGE}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
              />
            )}
          </Field>

          <Field label={t('content.field.body')} required>
            {({ id, describedBy, required }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                required={required}
                rows={10}
                lang={EDITORIAL_FALLBACK_LANGUAGE}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            )}
          </Field>

          <p className="text-caption text-text-secondary">{t('news.createDraftHint')}</p>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmingCreate}
        onOpenChange={setConfirmingCreate}
        title={t('news.createTitle')}
        description={t('news.createDescription', {
          language: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
        })}
        confirmLabel={t('news.createConfirm')}
        onConfirm={() => void confirmCreate()}
        loading={create.isPending}
      >
        <p className="text-body-small text-text-secondary">{t('news.createDraftHint')}</p>
      </ConfirmDialog>
    </>
  );
}
