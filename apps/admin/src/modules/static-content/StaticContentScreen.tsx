/**
 * M12 Static content — the app's fixed pages.
 *
 * **A closed set, not a collection**, and the screen is shaped by that rather than by
 * reusing M11's grid. There is no create, no delete and no search: there are six pages,
 * the app links to all six by slug, and the only question is which one to work on. So the
 * list is a rail rather than a table — six rows a reader takes in at once, each carrying
 * the two things that decide whether it needs attention: is it written at all, and which
 * languages are behind.
 *
 * The page being edited lives in the URL, so "the FAQ needs Tamil" is a link.
 *
 * **A page that has never been written is a state, not an absent row.** `creditTerms` in
 * the fixture is exactly that: the app falls back to its bundled default, and an office
 * that cannot see the page listed would assume it had already filled it in.
 *
 * **An edit to a published page is live when it is saved.** No second button, and the
 * asymmetry with M11 is deliberate: a *new* article must not appear half-written, while a
 * correction to the FAQ sitting in an unpublished draft leaves the wrong answer in front
 * of suppliers for as long as nobody remembers to press publish. What makes that safe is
 * the audit trail — every save records the previous wording and the new one, by name.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FileText, Send } from 'lucide-react';
import {
  EDITORIAL_FALLBACK_LANGUAGE,
  STATIC_PAGE_SLUGS,
  type AdminStaticPage,
  type LanguageCode,
  type StaticPageSlug,
} from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { GapNotice } from '@/modules/content/GapNotice';
import { LanguageStrip } from '@/modules/content/LanguageStrip';
import { PreviewPanel } from '@/modules/content/PreviewPanel';
import { TranslationEditor } from '@/modules/content/TranslationEditor';
import {
  useContentLanguages,
  usePublishStaticPage,
  useSaveStaticPageTranslation,
  useStaticPagePreview,
  useStaticPages,
} from '@/modules/content/hooks';

export function StaticContentScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const languages = useContentLanguages();
  const canWrite = useCan('content', 'write');
  const canPublish = useCan('content', 'approve');

  const pages = useStaticPages();

  /**
   * The slug in the URL is checked against the closed set, not trusted.
   *
   * A stale bookmark or a typo would otherwise select a page the app has no link to, and
   * the editor would write copy nothing ever renders.
   */
  const requested = params.get('page') as StaticPageSlug | null;
  const slug: StaticPageSlug =
    requested && STATIC_PAGE_SLUGS.includes(requested) ? requested : STATIC_PAGE_SLUGS[0];

  const [lang, setLang] = useState<LanguageCode>(EDITORIAL_FALLBACK_LANGUAGE);

  const preview = useStaticPagePreview(slug, lang);
  const save = useSaveStaticPageTranslation(slug);
  const publish = usePublishStaticPage(slug);
  const toast = useToast();

  function selectPage(next: StaticPageSlug) {
    const params2 = new URLSearchParams(params);
    params2.set('page', next);
    setParams(params2, { replace: true });
  }

  if (pages.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (pages.error || !pages.data) {
    return <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />;
  }

  const page = pages.data.find((candidate) => candidate.slug === slug);
  if (!page) return <ErrorState error={null} onRetry={() => void pages.refetch()} />;

  const published = page.status === 'published';
  const fallbackCopy = page.translations[EDITORIAL_FALLBACK_LANGUAGE];

  async function submitSave(body: Parameters<typeof save.mutateAsync>[0]['body']) {
    try {
      await save.mutateAsync({ lang, body });
      toast.success(
        t('content.saved', { language: t(`content.language.${lang}`) }),
        // Which is the whole point of saying it here: on a live page the save *is* the
        // publish, and an editor who does not know that will go looking for a button.
        published ? t('staticContent.savedLive') : undefined,
      );
    } catch (cause) {
      toast.error(t('content.saveFailed'), t(errorMessageKey(cause)));
    }
  }

  async function submitPublish() {
    try {
      await publish.mutateAsync();
      toast.success(t('staticContent.published', { page: t(`staticContent.page.${slug}`) }));
    } catch (cause) {
      toast.error(t('staticContent.publishFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <PageHeader title={t('staticContent.title')} description={t('staticContent.subtitle')} />

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        {/* The rail. Six rows, each stating the two things that decide whether it needs
            work: is it written at all, and which languages are behind. */}
        <Card>
          <CardHeader title={t('staticContent.pagesTitle')} />
          <CardBody className="p-0">
            <ul>
              {pages.data.map((candidate) => (
                <li key={candidate.slug}>
                  <PageRow
                    page={candidate}
                    active={candidate.slug === slug}
                    onSelect={() => selectPage(candidate.slug)}
                  />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-lg">
          <GapNotice gaps={page} published={published} />

          <Card>
            <CardHeader
              title={t(`staticContent.page.${slug}`)}
              description={
                published
                  ? t('staticContent.liveDescription', {
                      name: page.publishedByName ?? '—',
                      when: formatDateTime(page.publishedAt),
                    })
                  : t('staticContent.draftDescription')
              }
              actions={
                <LanguageStrip
                  languages={languages}
                  active={lang}
                  onSelect={setLang}
                  missing={page.missingLanguages}
                  stale={page.staleLanguages}
                />
              }
            />
            <CardBody className="flex flex-col gap-md">
              {/* Keyed by language, so switching tabs remounts the form — Sinhala text
                  can never be saved into the Tamil slot. */}
              <TranslationEditor
                key={`${slug}-${lang}`}
                lang={lang}
                translation={page.translations[lang]}
                source={fallbackCopy}
                // A static page has no feed to appear in, so no excerpt.
                withExcerpt={false}
                readOnly={!canWrite}
                saving={save.isPending}
                onSave={(body) => void submitSave(body)}
              />

              {!published ? (
                <div className="flex flex-col gap-xs border-t border-divider pt-md">
                  {canPublish ? (
                    <>
                      <Button
                        variant="primary"
                        disabled={!fallbackCopy}
                        loading={publish.isPending}
                        iconLeft={<Send className="size-icon-sm" aria-hidden />}
                        onClick={() => void submitPublish()}
                      >
                        {t('staticContent.publish')}
                      </Button>
                      <p className="text-caption text-text-secondary">
                        {fallbackCopy
                          ? t('staticContent.publishHint')
                          : t('staticContent.publishNeedsCopy', {
                              language: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
                            })}
                      </p>
                    </>
                  ) : (
                    // §12.1: the editor writes, the factory admin puts it in front of
                    // every supplier. Said rather than shown as a disabled button.
                    <p className="text-caption text-text-secondary">
                      {t('staticContent.publishNeedsAdmin')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="border-t border-divider pt-md text-caption text-text-secondary">
                  {t('staticContent.editsAreLive')}
                </p>
              )}
            </CardBody>
          </Card>

          <PreviewPanel
            lang={lang}
            preview={preview.data}
            loading={preview.isPending}
            error={preview.error}
            onRetry={() => void preview.refetch()}
          />
        </div>
      </div>
    </>
  );
}

function PageRow({
  page,
  active,
  onSelect,
}: {
  page: AdminStaticPage;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const gaps = page.missingLanguages.length + page.staleLanguages.length;
  const written = page.status === 'published' || page.translations[EDITORIAL_FALLBACK_LANGUAGE];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-sm border-l-2 px-lg py-sm text-left',
        active
          ? 'border-primary bg-primary-muted'
          : 'border-transparent hover:bg-surface-variant',
      )}
    >
      <FileText className="mt-xxs size-icon-sm shrink-0 text-text-secondary" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-xxs">
        <span
          className={cn(
            'text-body-small',
            active ? 'font-semibold text-primary' : 'text-text-primary',
          )}
        >
          {t(`staticContent.page.${page.slug}`)}
        </span>

        <span className="flex flex-wrap items-center gap-xxs">
          {/* Never written is its own badge, not an absence: the app is showing its
              bundled default, and an office that cannot see that assumes otherwise. */}
          {!written ? (
            <Badge tone="warning">{t('staticContent.notWritten')}</Badge>
          ) : (
            <Badge tone={page.status === 'published' ? 'success' : 'neutral'}>
              {t(`staticContent.status.${page.status}`)}
            </Badge>
          )}
          {gaps > 0 && written ? (
            <Badge tone={page.staleLanguages.length > 0 ? 'error' : 'warning'}>
              {t('content.badge.gaps', { count: gaps })}
            </Badge>
          ) : null}
        </span>
      </span>
    </button>
  );
}
