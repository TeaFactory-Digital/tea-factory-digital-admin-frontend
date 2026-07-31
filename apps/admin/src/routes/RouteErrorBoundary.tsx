/**
 * The last line of defence.
 *
 * A render error in one screen must not take the console down — a clerk halfway
 * through a queue should be able to navigate away and carry on. The boundary
 * therefore offers a reload and says plainly that the rest still works.
 */

import { useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function RouteErrorBoundary() {
  const { t } = useTranslation();
  const error = useRouteError();

  // Logged rather than displayed. A stack trace tells an office clerk nothing and
  // may carry a supplier's name from a props dump — which would be a PDPA problem
  // in a screenshot pasted into an email (§20.4).
  console.error('[route]', error);

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-sm bg-background p-lg text-center"
    >
      <TriangleAlert className="size-icon-xxl text-error" aria-hidden />
      <h1 className="text-h3 text-text-primary">{t('error.boundaryTitle')}</h1>
      <p className="max-w-prose text-body-small text-text-secondary">{t('error.boundaryBody')}</p>
      <Button variant="primary" onClick={() => window.location.reload()}>
        {t('error.reload')}
      </Button>
    </div>
  );
}
