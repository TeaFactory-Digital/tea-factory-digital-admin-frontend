/**
 * The last line of defence.
 *
 * A render error in one screen must not take the console down: a clerk halfway
 * through a queue should be able to navigate away and carry on. The boundary
 * therefore offers a reload and says plainly that the rest still works.
 */

import { useEffect, useRef } from 'react';
import { useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert, WifiOff } from 'lucide-react';
import { Logo } from '@/brand/Logo';
import { Button } from '@/components/ui/Button';
import { StatePicture } from '@/components/ui/states';
import { monitoring } from '@/lib/monitoring';
import { useOnline } from '@/lib/useOnline';

/**
 * A screen whose code could not be downloaded: the browser's words for a lazy route that
 * failed to load, in Chrome, Safari and Firefox.
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk/i.test(message);
}

export function RouteErrorBoundary() {
  const { t } = useTranslation();
  const error = useRouteError();

  // Logged rather than displayed. A stack trace tells an office clerk nothing and
  // may carry a supplier's name from a props dump, which would be a PDPA problem
  // in a screenshot pasted into an email (§20.4).
  console.error('[route]', error);
  // Reported as the error alone, never the props around it (`lib/monitoring.ts`).
  useEffect(() => monitoring.recordError(error, 'route'), [error]);

  /**
   * No connection (26 November 2026): a screen not yet opened on this computer cannot be
   * fetched while the line is down. Said as that, not as a broken console, and the page
   * reloads by itself once the connection is back.
   */
  const online = useOnline();
  const connection = !online || isChunkLoadError(error);
  const wasOffline = useRef(!online);
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (connection && wasOffline.current) window.location.reload();
  }, [online, connection]);

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-sm bg-background p-lg text-center"
    >
      {/* The mark, because this screen replaces the whole shell: without it a
          clerk cannot tell a broken console apart from a page that is not theirs. */}
      <Logo className="mb-md" />
      <div className="tfd-empty flex flex-col items-center gap-sm">
        <StatePicture Icon={connection ? WifiOff : TriangleAlert} tone={connection ? 'warning' : 'error'} />
        <h1 className="tfd-empty-text text-h3 text-text-primary">
          {t(connection ? 'connection.boundaryTitle' : 'error.boundaryTitle')}
        </h1>
        <p className="tfd-empty-text max-w-prose text-body-small text-text-secondary">
          {t(connection ? 'connection.boundaryBody' : 'error.boundaryBody')}
        </p>
      </div>
      <Button variant="primary" onClick={() => window.location.reload()}>
        {t('error.reload')}
      </Button>
    </div>
  );
}
