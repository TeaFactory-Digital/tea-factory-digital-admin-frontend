/**
 * What a supplier reading in this language actually gets.
 *
 * **Fetched from the server, not composed here**, and that is the whole reason this
 * component exists rather than the screen rendering the translation it already holds. The
 * fallback is a rule the app applies; a console that applied its own version would show
 * the editor a preview of something that is never rendered, and the editor would sign off
 * copy nobody sees. AC-08 asks for the gap to be visible — a wrong preview makes it
 * invisible in the most convincing way available.
 *
 * The banner when a fallback is in use is the point of the panel. Without it the preview
 * looks like a translated article and the gap disappears.
 */

import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import type { ContentPreview, LanguageCode } from '@tfd/domain';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';

export function PreviewPanel({
  lang,
  preview,
  loading,
  error,
  onRetry,
}: {
  lang: LanguageCode;
  preview: ContentPreview | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader
        title={t('content.previewTitle')}
        description={t('content.previewDescription', { language: t(`content.language.${lang}`) })}
      />
      <CardBody>
        {loading ? (
          <div className="flex justify-center py-lg">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : !preview?.translation ? (
          // Nothing to show in **any** language — the one state that must never reach a
          // supplier, and why the fallback copy is required before a publish.
          <EmptyState title={t('content.previewEmpty')} body={t('content.previewEmptyHint')} />
        ) : (
          <div className="flex flex-col gap-sm">
            {preview.usedFallback ? (
              <p className="flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
                <Languages className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                {t('content.previewFallback', {
                  requested: t(`content.language.${preview.lang}`),
                  fallback: t(`content.language.${preview.fallbackLanguage}`),
                })}
              </p>
            ) : null}

            {/**
             * `lang` on the rendered copy, not on the card.
             *
             * It is what makes the base stylesheet's Sinhala and Tamil rules apply — and
             * on a fallback it is deliberately the **fallback's** language rather than
             * the requested one, because that is what the text actually is. Declaring
             * Sinhala over English copy would be a lie a screen reader acts on.
             */}
            <article
              lang={preview.translation.lang}
              className="flex flex-col gap-xs rounded-md bg-surface-variant px-md py-sm"
            >
              <h3 className="text-subtitle text-text-primary">{preview.translation.title}</h3>
              {preview.translation.excerpt ? (
                <p className="text-body-small font-medium text-text-secondary">
                  {preview.translation.excerpt}
                </p>
              ) : null}
              <p className="max-w-prose whitespace-pre-wrap text-body-small text-text-primary">
                {preview.translation.body}
              </p>
            </article>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
