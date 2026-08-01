/**
 * One article: its copy in each language, and its lifecycle.
 *
 * The layout answers the three questions an editor arrives with, in order:
 *
 *  1. **Which languages still need work?** — the language strip, where the gap is on the
 *     tab for the language that has it (see `LanguageStrip`).
 *  2. **What does a supplier reading in this language get?** — the preview, resolved by
 *     the server so it is the app's answer rather than the console's.
 *  3. **Can this go out?** — the lifecycle card, which states what publishing will mean
 *     for the languages that are not finished instead of quietly allowing it.
 *
 * **Publishing with gaps is allowed and loud.** That is the AC-08 policy, not a
 * compromise: `EDITORIAL_FALLBACK_LANGUAGE` is documented as "the fallback, not a
 * default", which only means anything if content can go out incomplete. The one hard
 * refusal is a record with no fallback copy at all — there would be nothing to fall back
 * *to* — and the confirmation names every language that will fall back before anybody
 * agrees to it.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Eye, EyeOff, Send } from 'lucide-react';
import { EDITORIAL_FALLBACK_LANGUAGE, type LanguageCode } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { AuditPanel } from '@/components/AuditPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { GapNotice } from '@/modules/content/GapNotice';
import { LanguageStrip } from '@/modules/content/LanguageStrip';
import { PreviewPanel } from '@/modules/content/PreviewPanel';
import { TranslationEditor } from '@/modules/content/TranslationEditor';
import {
  useContentLanguages,
  useNewsArticle,
  useNewsAudit,
  useNewsLifecycle,
  useNewsPreview,
  useSaveNewsTranslation,
  type NewsLifecycleVerb,
} from '@/modules/content/hooks';

export function NewsArticleScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();

  const languages = useContentLanguages();
  const canWrite = useCan('content', 'write');
  const canPublish = useCan('content', 'approve');

  const [lang, setLang] = useState<LanguageCode>(EDITORIAL_FALLBACK_LANGUAGE);
  const [confirming, setConfirming] = useState<NewsLifecycleVerb | null>(null);

  const article = useNewsArticle(id);
  const preview = useNewsPreview(id, lang);
  const audit = useNewsAudit(id);
  const save = useSaveNewsTranslation(id ?? '');
  const lifecycle = useNewsLifecycle(id ?? '');

  if (article.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (article.error || !article.data) {
    return <ErrorState error={article.error} onRetry={() => void article.refetch()} />;
  }

  const data = article.data;
  const fallbackCopy = data.translations[EDITORIAL_FALLBACK_LANGUAGE];
  const published = data.status === 'published';

  async function submitSave(body: Parameters<typeof save.mutateAsync>[0]['body']) {
    try {
      await save.mutateAsync({ lang, body });
      toast.success(t('content.saved', { language: t(`content.language.${lang}`) }));
    } catch (cause) {
      toast.error(t('content.saveFailed'), t(errorMessageKey(cause)));
    }
  }

  /**
   * Keys spelled out rather than built from the verb.
   *
   * `` `news.${verb}ed` `` reads fine and produces `news.archiveed` — a key that resolves
   * to itself, so the toast shows a dotted string to the office and nothing fails loudly
   * enough to notice. Interpolated i18n keys are also invisible to a grep for unused
   * copy, which is how the string table rots.
   */
  const LIFECYCLE_KEYS: Record<NewsLifecycleVerb, { done: string; failed: string }> = {
    publish: { done: 'news.published', failed: 'news.publishFailed' },
    unpublish: { done: 'news.unpublished', failed: 'news.unpublishFailed' },
    archive: { done: 'news.archived', failed: 'news.archiveFailed' },
  };

  async function submitLifecycle(verb: NewsLifecycleVerb) {
    try {
      await lifecycle.mutateAsync(verb);
      setConfirming(null);
      toast.success(t(LIFECYCLE_KEYS[verb].done));
    } catch (cause) {
      // The dialog stays open: `fallback-translation-missing` is information about what
      // to write next, not a toast over a closed dialog.
      toast.error(t(LIFECYCLE_KEYS[verb].failed), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/news"
            className="inline-flex items-center gap-xxs text-primary underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-icon-xs" aria-hidden />
            {t('news.backToList')}
          </Link>
        }
        title={fallbackCopy?.title ?? t('news.untitled')}
        description={t('content.lastEditedBy', {
          name: data.updatedByName,
          when: formatDateTime(data.updatedAt),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            <Badge tone={published ? 'success' : 'neutral'}>{t(`news.status.${data.status}`)}</Badge>
          </div>
        }
      />

      <GapNotice gaps={data} published={published} />

      <div className="grid gap-lg lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title={t('content.copyTitle')}
            description={t('content.copyDescription')}
            actions={
              <LanguageStrip
                languages={languages}
                active={lang}
                onSelect={setLang}
                missing={data.missingLanguages}
                stale={data.staleLanguages}
              />
            }
          />
          <CardBody>
            {/**
             * Keyed by language, so switching tabs **remounts** the form.
             *
             * Without it the fields would carry Sinhala text into the Tamil tab and a
             * save would file it under the wrong language — a mistake nothing downstream
             * could detect, because both are valid strings.
             */}
            <TranslationEditor
              key={lang}
              lang={lang}
              translation={data.translations[lang]}
              source={fallbackCopy}
              withExcerpt
              readOnly={!canWrite}
              saving={save.isPending}
              onSave={(body) => void submitSave(body)}
            />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-lg">
          <PreviewPanel
            lang={lang}
            preview={preview.data}
            loading={preview.isPending}
            error={preview.error}
            onRetry={() => void preview.refetch()}
          />

          <Card>
            <CardHeader
              title={t('news.lifecycleTitle')}
              description={
                published ? t('news.lifecyclePublished') : t('news.lifecycleDraft')
              }
            />
            <CardBody className="flex flex-col gap-sm">
              {published && data.publishedAt ? (
                <p className="text-caption text-text-secondary">
                  {t('news.publishedBy', {
                    name: data.publishedByName ?? '—',
                    when: formatDateTime(data.publishedAt),
                  })}
                </p>
              ) : null}

              {canPublish ? (
                <div className="flex flex-wrap gap-sm">
                  {data.status !== 'published' ? (
                    <Button
                      variant="primary"
                      iconLeft={<Send className="size-icon-sm" aria-hidden />}
                      onClick={() => setConfirming('publish')}
                    >
                      {t('news.publish')}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      iconLeft={<EyeOff className="size-icon-sm" aria-hidden />}
                      onClick={() => setConfirming('unpublish')}
                    >
                      {t('news.unpublish')}
                    </Button>
                  )}

                  {data.status !== 'archived' ? (
                    <Button
                      variant="ghost"
                      iconLeft={<Archive className="size-icon-sm" aria-hidden />}
                      onClick={() => setConfirming('archive')}
                    >
                      {t('news.archive')}
                    </Button>
                  ) : null}
                </div>
              ) : (
                // §12.1: the editor writes, the factory admin publishes. Said rather
                // than shown as a disabled button nobody can explain.
                <p className="text-caption text-text-secondary">{t('news.publishNeedsAdmin')}</p>
              )}

              <p className="text-caption text-text-secondary">{t('news.noDeleteHint')}</p>
            </CardBody>
          </Card>

          {/* Renders nothing for an editor: §12.1 gives them `content: W` and no
              `auditLog` grant, and an empty panel labelled "audit trail" would read as
              "nothing was recorded". */}
          <AuditPanel
            title={t('content.auditTitle')}
            page={audit.data}
            loading={audit.isPending}
          />
        </div>
      </div>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={confirming ? t(`news.confirm.${confirming}Title`) : ''}
        description={confirming ? t(`news.confirm.${confirming}Body`) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={confirming === 'archive' ? 'danger' : 'primary'}
              loading={lifecycle.isPending}
              onClick={() => confirming && void submitLifecycle(confirming)}
            >
              {confirming ? t(`news.confirm.${confirming}Action`) : ''}
            </Button>
          </>
        }
      >
        {/**
         * The gaps, repeated in the confirmation — the part of AC-08 that makes the
         * decision informed rather than merely recorded.
         *
         * "Publish" over a list of languages that will fall back is a different act from
         * "publish" over nothing, and the person holding `content: approve` is usually
         * not the person who wrote it and has no other way to know.
         */}
        {confirming === 'publish' ? (
          <div className="flex flex-col gap-sm">
            <GapNotice gaps={data} published />
            {data.missingLanguages.filter((one) => one !== EDITORIAL_FALLBACK_LANGUAGE).length >
            0 ? (
              <p className="flex items-start gap-xs text-body-small text-text-secondary">
                <Eye className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('news.confirm.publishWithGaps')}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
