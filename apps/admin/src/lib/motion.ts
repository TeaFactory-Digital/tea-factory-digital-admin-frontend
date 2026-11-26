/**
 * Whether the console may move (26 November 2026), asked in one place.
 *
 * Two answers can say no, and either is enough: the person's own Animations switch on the
 * profile (`Appearance.motion`, written to `<html data-motion="off">` by `BrandProvider`), and
 * the operating system's "reduce motion". The CSS follows the same two (`theme.css`), so a
 * keyframe and a script never disagree about whether something moves.
 *
 * Read from the attribute rather than from the appearance context, so code outside React
 * (`useNavigate`'s View Transition, a one-off timer) can ask without a hook.
 */

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function motionAllowed(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'off') {
    return false;
  }
  return !prefersReducedMotion();
}

/**
 * The console's timings, in milliseconds. A press answers at once, an arrival settles a
 * little slower, and a figure takes longest because the eye has to follow it. The curves
 * are CSS tokens (`ease-settle`, `ease-move` in `theme.css`).
 */
export const MOTION_MS = {
  tap: 120,
  fast: 180,
  base: 280,
  page: 350,
  move: 450,
  count: 700,
} as const;
