/**
 * The boot splash: the factory's mark and its name, while the console works out
 * which factory it is.
 *
 * There is a real gap to cover. A cold document has no access token (it lives in
 * memory by design), so `bootstrap()` has to spend a round trip on the refresh
 * cookie before anything behind `RequireAuth` can render, and `GET /config` has
 * to land before the factory's name and colours are known. On office wifi that is
 * a second or two of a page that is branded but empty — and the first thing a
 * clerk sees on a shared machine should say which factory this console belongs
 * to, because the answer decides whether they are about to enter today's leaf
 * into the right deployment.
 *
 * Two rules keep it from becoming the thing it is covering for:
 *
 *  1. **It is an overlay, not a gate.** The router mounts behind it, so a screen's
 *     lazy chunk is already downloading while the splash is up.
 *  2. **It is capped.** `RuntimeConfigProvider` never blocks on `/config` by
 *     design; a splash that waited for it would reintroduce exactly the blocking
 *     boot that provider was written to avoid. After `MAX_VISIBLE_MS` the console
 *     is shown regardless, degraded banner and all.
 */

import { useEffect, useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/auth/authStore';
import { useFactory, useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { Spinner } from '@/components/ui/states';
import { Logo } from './Logo';

/**
 * Long enough that a fast boot is a splash rather than a flicker. Below roughly
 * half a second a full-screen panel appearing and leaving reads as a glitch, and
 * an office clerk reports it as one.
 */
const MIN_VISIBLE_MS = 700;

/**
 * The cap. A `/config` that is slow, or an API that is down and still inside the
 * transport's retry, must not hold the console behind a logo: the sign-in form
 * works without either answer.
 */
const MAX_VISIBLE_MS = 2500;

export function SplashScreen() {
  const { t } = useTranslation();
  const factory = useFactory();

  /**
   * `bg-surface`, not `bg-background`: surface is white in every scheme
   * `@tfd/brand` ships, and white is the one colour the static splash in
   * `index.html` can hardcode without duplicating a brand token there. The two
   * panels then hand over without a change of tone, so a cold boot reads as one
   * screen rather than three.
   */
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-xl bg-surface p-lg">
      <div className="flex flex-col items-center gap-md text-center">
        <Logo size="xl" showName={false} />
        <div className="flex flex-col gap-xxs">
          {/* Not an `<h1>`: the routed screen behind this overlay owns the
              document's heading, and two would break the outline for the sake of
              a panel that is gone in a second. */}
          <p className="text-h2 text-text-primary">{factory.name}</p>
          <p className="text-body-small text-text-secondary">{t('splash.subtitle')}</p>
        </div>
      </div>

      {/* The spinner carries the accessible "Loading…" for the whole panel. */}
      <Spinner />
    </div>
  );
}

/**
 * Renders the app, with the splash over it until the console knows itself.
 *
 * Sits inside `RuntimeConfigProvider` — it has to, since the name it shows comes
 * from there — and above the router.
 */
export function BootSplash({ children }: PropsWithChildren) {
  const { loading } = useRuntimeConfig();
  const authStatus = useAuthStore((s) => s.status);
  const booting = loading || authStatus === 'bootstrapping';

  const [minElapsed, setMinElapsed] = useState(false);
  const [capped, setCapped] = useState(false);

  useEffect(() => {
    const min = window.setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const cap = window.setTimeout(() => setCapped(true), MAX_VISIBLE_MS);
    return () => {
      window.clearTimeout(min);
      window.clearTimeout(cap);
    };
  }, []);

  /**
   * Retire the static splash from `index.html`.
   *
   * In an effect rather than in `main.tsx`, because an effect runs after React
   * has painted: removing it before the first commit would show a white frame
   * between the two splashes, which is the flash both of them exist to prevent.
   */
  useEffect(() => {
    document.getElementById('boot-splash')?.remove();
  }, []);

  const visible = !capped && (booting || !minElapsed);

  return (
    <>
      {children}
      {visible ? <SplashScreen /> : null}
    </>
  );
}
