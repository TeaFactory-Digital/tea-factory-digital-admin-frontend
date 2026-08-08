/**
 * One banner: its copy in each language, where its button goes, and when it runs.
 *
 * The layout answers the editor's questions in the same order M11's article screen does,
 * with one inserted at the top that an article does not have:
 *
 *  0. **Is this in front of anybody right now?** — the window card. A banner has a status
 *     *and* a live window, and the two disagree constantly: a published banner scheduled
 *     for next week is in front of nobody, and one whose `endsAt` passed on Tuesday reads
 *     "published" everywhere while showing to no one.
 *  1. **Which languages still need work?** — the language strip, gap on the tab that has it.
 *  2. **What does a supplier reading in this language get?** — the server-resolved preview.
 *  3. **Can this go out?** — the lifecycle card.
 *
 * **The action gets a card of its own**, and that is the decision worth defending. It
 * looks like a field and behaves like one, but it is the only thing on this screen that
 * fails *silently on the phone*: `banners.md` says an action the app cannot resolve
 * renders artwork with no button and reports nothing. Buried in a form it would be the
 * field nobody checks; given a card with the resolved target printed under it, an editor
 * can see what the app will do before anybody publishes.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Eye, EyeOff, Save, Send } from 'lucide-react';
import type { BannerAction } from '@tfd/domain';
import {
  EDITORIAL_FALLBACK_LANGUAGE,
  bannerActionProblem,
  bannerWindowState,
  type LanguageCode,
} from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { AuditPanel } from '@/components/AuditPanel';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Notice, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { LanguageStrip } from '@/modules/content/LanguageStrip';
import { PreviewPanel } from '@/modules/content/PreviewPanel';
import { useContentLanguages } from '@/modules/content/hooks';
import { BannerActionField } from './BannerActionField';
import { BannerTranslationEditor } from './BannerTranslationEditor';
import {
  useBanner,
  useBannerAudit,
  useBannerLifecycle,
  useBannerPreview,
  usePatchBanner,
  useSaveBannerTranslation,
  type BannerLifecycleVerb,
} from './hooks';

const WINDOW_TONES: Record<'scheduled' | 'live' | 'expired', BadgeTone> = {
  scheduled: 'info',
  live: 'success',
  expired: 'neutral',
};

/** ISO → the value a `datetime-local` input wants, in the reader's own timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function BannerEditorScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();

  const languages = useContentLanguages();
  const canWrite = useCan('content', 'write');
  const canPublish = useCan('content', 'approve');

  const [lang, setLang] = useState<LanguageCode>(EDITORIAL_FALLBACK_LANGUAGE);
  const [confirming, setConfirming] = useState<BannerLifecycleVerb | null>(null);

  const banner = useBanner(id);
  const preview = useBannerPreview(id, lang);
  const audit = useBannerAudit(id);
  const save = useSaveBannerTranslation(id ?? '');
  const patch = usePatchBanner(id ?? '');
  const lifecycle = useBannerLifecycle(id ?? '');

  /**
   * The action and window are drafted locally and saved as a unit.
   *
   * `null` means "showing the server's value". The alternative — seeding state from the
   * record on mount — would silently discard a colleague's edit that arrived in a
   * refetch, which for a live banner is a change somebody made *because it was wrong*.
   */
  const [draftAction, setDraftAction] = useState<BannerAction | null>(null);
  const [draftStartsAt, setDraftStartsAt] = useState<string | null>(null);
  const [draftEndsAt, setDraftEndsAt] = useState<string | null>(null);

  if (banner.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (banner.error || !banner.data) {
    return <ErrorState error={banner.error} onRetry={() => void banner.refetch()} />;
  }

  const data = banner.data;
  const fallbackCopy = data.translations[EDITORIAL_FALLBACK_LANGUAGE];
  const published = data.status === 'published';

  const action = draftAction ?? data.action;
  const startsAt = draftStartsAt ?? toLocalInput(data.startsAt);
  const endsAt = draftEndsAt ?? toLocalInput(data.endsAt);

  const actionProblem = bannerActionProblem(action);
  const windowBackwards = endsAt !== '' && endsAt < startsAt;
  const settingsDirty =
    draftAction !== null || draftStartsAt !== null || draftEndsAt !== null;

  /**
   * Where the banner is in its window **as the server last computed it**.
   *
   * Recomputed here only against the unsaved draft, so an editor moving `startsAt` sees
   * the consequence before saving. The badge above it is the record's own state.
   */
  const draftWindow = bannerWindowState(
    {
      startsAt: startsAt ? new Date(startsAt).toISOString() : data.startsAt,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    },
    new Date().toISOString(),
  );

  async function submitSave(body: Parameters<typeof save.mutateAsync>[0]['body']) {
    try {
      await save.mutateAsync({ lang, body });
      toast.success(t('content.saved', { language: t(`content.language.${lang}`) }));
    } catch (cause) {
      toast.error(t('content.saveFailed'), t(errorMessageKey(cause)));
    }
  }

  async function submitSettings() {
    try {
      await patch.mutateAsync({
        action,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
      setDraftAction(null);
      setDraftStartsAt(null);
      setDraftEndsAt(null);
      toast.success(t('banners.settingsSaved'));
    } catch (cause) {
      toast.error(t('banners.settingsSaveFailed'), t(errorMessageKey(cause)));
    }
  }

  /**
   * Keys spelled out rather than built from the verb — `` `banners.${verb}ed` `` produces
   * `banners.archiveed`, a key that resolves to itself and shows a dotted string to the
   * office without failing loudly enough for anybody to notice.
   */
  const LIFECYCLE_KEYS: Record<BannerLifecycleVerb, { done: string; failed: string }> = {
    publish: { done: 'banners.published', failed: 'banners.publishFailed' },
    unpublish: { done: 'banners.unpublished', failed: 'banners.unpublishFailed' },
    archive: { done: 'banners.archived', failed: 'banners.archiveFailed' },
  };

  async function submitLifecycle(verb: BannerLifecycleVerb) {
    try {
      await lifecycle.mutateAsync(verb);
      setConfirming(null);
      toast.success(t(LIFECYCLE_KEYS[verb].done));
    } catch (cause) {
      toast.error(t(LIFECYCLE_KEYS[verb].failed), t(errorMessageKey(cause)));
    }
  }

  const missingBeyondFallback = data.missingLanguages.filter(
    (one) => one !== EDITORIAL_FALLBACK_LANGUAGE,
  );

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/banners"
            className="inline-flex items-center gap-xxs text-primary underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-icon-xs" aria-hidden />
            {t('banners.backToList')}
          </Link>
        }
        title={fallbackCopy?.title ?? t('banners.untitled')}
        description={t('content.lastEditedBy', {
          name: data.updatedByName,
          when: formatDateTime(data.updatedAt),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            <Badge tone={published ? 'success' : 'neutral'}>
              {t(`banners.status.${data.status}`)}
            </Badge>
            {published ? (
              <Badge tone={WINDOW_TONES[draftWindow]}>{t(`banners.window.${draftWindow}`)}</Badge>
            ) : null}
          </div>
        }
      />

      {/**
       * The state that catches everybody out: published, and in front of nobody.
       *
       * Said here rather than left to two badges the reader has to combine, because the
       * office's question is "why are suppliers not seeing this" and the answer is a
       * date, not a status.
       */}
      {published && draftWindow !== 'live' ? (
        <Notice tone="warning">
          <span>
            <strong className="font-semibold">
              {t(`banners.notLive.${draftWindow}Title`)}
            </strong>{' '}
            {t(`banners.notLive.${draftWindow}Body`)}
          </span>
        </Notice>
      ) : null}

      {missingBeyondFallback.length > 0 ? (
        <Notice tone={published ? 'warning' : 'info'}>
          <span>
            {t('banners.gapNotice', {
              languages: missingBeyondFallback
                .map((one) => t(`content.language.${one}`))
                .join(', '),
              fallback: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
            })}
          </span>
        </Notice>
      ) : null}

      <div className="grid gap-lg lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-lg">
          <Card>
            <CardHeader
              title={t('banners.copyTitle')}
              description={t('banners.copyDescription')}
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
              {/* Keyed by language so switching tabs remounts — see M11's editor for
                  why a shared draft state files Sinhala under Tamil. */}
              <BannerTranslationEditor
                key={lang}
                lang={lang}
                translation={data.translations[lang]}
                source={fallbackCopy}
                readOnly={!canWrite}
                saving={save.isPending}
                onSave={(body) => void submitSave(body)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('banners.settingsTitle')}
              description={t('banners.settingsDescription')}
            />
            <CardBody className="flex flex-col gap-md">
              <BannerActionField
                value={action}
                onChange={setDraftAction}
                disabled={!canWrite}
              />

              <div className="grid gap-sm sm:grid-cols-2">
                <Field label={t('banners.field.startsAt')} required>
                  {({ id: fieldId, describedBy, required }) => (
                    <Input
                      id={fieldId}
                      type="datetime-local"
                      aria-describedby={describedBy}
                      required={required}
                      disabled={!canWrite}
                      value={startsAt}
                      onChange={(event) => setDraftStartsAt(event.target.value)}
                    />
                  )}
                </Field>

                <Field
                  label={t('banners.field.endsAt')}
                  hint={t('banners.field.endsAtHint')}
                  error={windowBackwards ? t('banners.window.backwards') : undefined}
                >
                  {({ id: fieldId, describedBy, invalid }) => (
                    <Input
                      id={fieldId}
                      type="datetime-local"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      disabled={!canWrite}
                      value={endsAt}
                      onChange={(event) => setDraftEndsAt(event.target.value)}
                    />
                  )}
                </Field>
              </div>

              {canWrite ? (
                <div className="flex flex-wrap items-center gap-sm border-t border-divider pt-md">
                  <Button
                    variant="primary"
                    iconLeft={<Save className="size-icon-sm" aria-hidden />}
                    disabled={!settingsDirty || Boolean(actionProblem) || windowBackwards}
                    loading={patch.isPending}
                    onClick={() => void submitSettings()}
                  >
                    {t('banners.saveSettings')}
                  </Button>
                  <p className="text-caption text-text-secondary">
                    {actionProblem
                      ? t(actionProblem)
                      : windowBackwards
                        ? t('banners.window.backwards')
                        : settingsDirty
                          ? t('content.unsaved')
                          : t('banners.settingsCurrent')}
                  </p>
                </div>
              ) : (
                <p className="text-caption text-text-secondary">{t('content.readOnly')}</p>
              )}
            </CardBody>
          </Card>
        </div>

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
              title={t('banners.lifecycleTitle')}
              description={published ? t('banners.lifecyclePublished') : t('banners.lifecycleDraft')}
            />
            <CardBody className="flex flex-col gap-sm">
              {published && data.publishedAt ? (
                <p className="text-caption text-text-secondary">
                  {t('banners.publishedBy', {
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
                      disabled={Boolean(actionProblem)}
                      onClick={() => setConfirming('publish')}
                    >
                      {t('banners.publish')}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      iconLeft={<EyeOff className="size-icon-sm" aria-hidden />}
                      onClick={() => setConfirming('unpublish')}
                    >
                      {t('banners.unpublish')}
                    </Button>
                  )}

                  {data.status !== 'archived' ? (
                    <Button
                      variant="ghost"
                      iconLeft={<Archive className="size-icon-sm" aria-hidden />}
                      onClick={() => setConfirming('archive')}
                    >
                      {t('banners.archive')}
                    </Button>
                  ) : null}
                </div>
              ) : (
                // §12.1: the editor writes, the factory admin publishes. The same
                // boundary M11 draws between writing a circular and putting it in front
                // of every supplier the factory has.
                <p className="text-caption text-text-secondary">{t('banners.publishNeedsAdmin')}</p>
              )}

              {/* Publishing a banner whose button the app will refuse is the one refusal
                  worth stating on the control rather than in the confirmation: there is
                  no fallback for an action, so it is not a gap the office may accept. */}
              {actionProblem && data.status !== 'published' ? (
                <p className="text-caption text-error">{t('banners.publishNeedsAction')}</p>
              ) : null}

              <p className="text-caption text-text-secondary">{t('banners.noDeleteHint')}</p>
            </CardBody>
          </Card>

          <AuditPanel title={t('banners.auditTitle')} page={audit.data} loading={audit.isPending} />
        </div>
      </div>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={confirming ? t(`banners.confirm.${confirming}Title`) : ''}
        description={confirming ? t(`banners.confirm.${confirming}Body`) : undefined}
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
              {confirming ? t(`banners.confirm.${confirming}Action`) : ''}
            </Button>
          </>
        }
      >
        {confirming === 'publish' ? (
          <div className="flex flex-col gap-sm">
            {missingBeyondFallback.length > 0 ? (
              <p className="flex items-start gap-xs text-body-small text-text-secondary">
                <Eye className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('banners.confirm.publishWithGaps', {
                  languages: missingBeyondFallback
                    .map((one) => t(`content.language.${one}`))
                    .join(', '),
                })}
              </p>
            ) : null}
            {/* When it will actually appear, in the confirmation. Publishing a banner
                scheduled for next Tuesday is a different act from publishing one that
                goes live the moment the button is pressed. */}
            <p className="text-body-small text-text-secondary">
              {draftWindow === 'live'
                ? t('banners.confirm.publishLiveNow')
                : t('banners.confirm.publishScheduled', { when: formatDateTime(data.startsAt) })}
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
