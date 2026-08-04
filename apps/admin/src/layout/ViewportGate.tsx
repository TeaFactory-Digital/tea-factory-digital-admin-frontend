/**
 * The viewport floor: tablet and above, nothing narrower.
 *
 * The console is an *office* surface. Its screens are twelve-column grids, wide
 * data tables with a sticky action column, and side-by-side approve/reject forms —
 * built against the 1366×768 laptops the office actually runs (see
 * `playwright.config.ts`). None of that reflows onto a phone, and the failure mode
 * is not a cramped layout: it is a clerk approving the wrong row because the table
 * scrolled sideways under their thumb. Suppliers have the mobile app; the office
 * has this.
 *
 * So the floor is enforced rather than designed around, and a phone gets one plain
 * screen that says which device to use instead of a console it cannot drive safely.
 *
 * Two properties worth keeping:
 *
 *  1. **It gates, it does not overlay.** The router is not mounted below the floor,
 *     so no screen's chunk downloads and no query fires on a phone — the opposite
 *     of `BootSplash`, which covers a mounted app on purpose.
 *  2. **It is live.** A desktop window dragged narrow crosses the floor and comes
 *     back, and rotating a small tablet to landscape is the fix the copy suggests,
 *     so the check cannot be a boot-time snapshot.
 */

import { useEffect, useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { MonitorSmartphone } from 'lucide-react';
import { Logo } from '@/brand/Logo';

/**
 * 768 CSS px: Tailwind's `md` breakpoint, and an iPad in portrait.
 *
 * The same number the responsive utilities in the screens already switch on, which
 * is what makes the floor coherent — every `md:` rule in the codebase is now the
 * *narrowest* layout that can be reached, and nothing below it has to be designed
 * for.
 */
export const MIN_VIEWPORT_WIDTH = 768;

/**
 * A height floor as well, because a width floor alone lets a landscape phone
 * through: 900×400 is wide enough to pass and far too short to work — the topbar,
 * a page header and a table header leave about one row of data.
 *
 * 480 px is below any laptop or tablet in either orientation and above every phone
 * in landscape, so it separates the two without catching a shortened desktop
 * window.
 */
export const MIN_VIEWPORT_HEIGHT = 480;

/**
 * Measured off `window.inner*` rather than `matchMedia`.
 *
 * The two agree on what matters here — both are CSS pixels, so both react to
 * browser zoom the same way — and the numbers are needed anyway for the caption on
 * the blocking screen. It also keeps the gate honest under jsdom, where
 * `matchMedia` exists but never matches anything: a `matchMedia` gate would report
 * every test environment as a phone.
 */
function viewportFits(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= MIN_VIEWPORT_WIDTH && window.innerHeight >= MIN_VIEWPORT_HEIGHT;
}

/**
 * Tracks whether the window clears the floor.
 *
 * Deliberately a boolean and not the dimensions: this hook sits above the whole
 * router, and storing the size here would re-render every mounted screen on every
 * pixel of a window drag. The blocking screen — which is small, and the only thing
 * that wants the numbers — reads them itself.
 */
function useViewportFits(): boolean {
  const [fits, setFits] = useState(viewportFits);

  useEffect(() => {
    const check = () => setFits(viewportFits());

    // `orientationchange` as well as `resize`: iOS Safari has historically fired
    // the rotation event before the new dimensions are readable, so the resize
    // that follows is what actually corrects the answer. Both are idempotent.
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);

    // A re-check on mount, because the first paint can arrive after a rotation
    // that happened while the bundle was still downloading.
    check();

    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return fits;
}

/**
 * The blocking screen.
 *
 * Carries the mark, for the same reason `RouteErrorBoundary` does: without it a
 * clerk who opened the wrong bookmark cannot tell "this console is not for phones"
 * apart from "this is not my factory's console".
 *
 * The measured size is on it on purpose. It is what turns "it says the screen is
 * too small" into a support answer — the office reads back two numbers — and on a
 * desktop window being dragged it counts up towards the minimum, which explains
 * the rule better than the sentence above it does.
 */
function ViewportTooSmall() {
  const { t } = useTranslation();
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const measure = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-sm bg-background p-lg text-center"
    >
      <Logo className="mb-md" />
      <MonitorSmartphone className="size-icon-xxl text-text-secondary" aria-hidden />
      <h1 className="text-h3 text-text-primary">{t('viewport.tooSmallTitle')}</h1>
      <p className="max-w-prose text-body-small text-text-secondary">
        {t('viewport.tooSmallBody')}
      </p>
      {/* `numeric` for the tabular figures, so the numbers do not jitter sideways
          while a window is being dragged. */}
      <p className="numeric text-caption text-text-secondary">
        {t('viewport.tooSmallSize', {
          width: size.width,
          height: size.height,
          minWidth: MIN_VIEWPORT_WIDTH,
          minHeight: MIN_VIEWPORT_HEIGHT,
        })}
      </p>
    </div>
  );
}

/** Renders the console, or the blocking screen if the window is below the floor. */
export function ViewportGate({ children }: PropsWithChildren) {
  return useViewportFits() ? <>{children}</> : <ViewportTooSmall />;
}
