/**
 * The turning mark every spinner in the console draws.
 *
 * Artwork only — no `role`, no label. The two spinners that use it disagree about
 * what they mean: the standalone `Spinner` in `states.tsx` is a live region that
 * announces "Loading…", while the one inside a `Button` is decorative, because
 * that button already carries `aria-busy` and its own text. A mark that hardcoded
 * either would be wrong in the other place, so the meaning stays with the caller.
 *
 * It lives in its own module rather than in `states.tsx` because `states.tsx`
 * imports `Button` (for `ErrorState`'s retry) and `Button` needs this — importing
 * it from there would close that loop.
 *
 * `fill="currentColor"`, so the arc takes the colour of whatever it is placed in:
 * `text-primary` on the standalone spinner, the button's own foreground inside a
 * primary or danger button, where a fixed brand blue would be invisible.
 */

import { cn } from '@/lib/cn';

export function SpinnerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      // Decorative in the DOM sense: the arc conveys nothing a screen reader can
      // use, and `focusable` keeps older engines from putting it in the tab order.
      aria-hidden
      focusable="false"
      className={cn('animate-spinner', className)}
    >
      {/* One arc of a ring, three quarters open — the gap is what makes the
          rotation visible. Drawn at a 24 px viewBox and scaled by the caller. */}
      <path d="M12,23a9.63,9.63,0,0,1-8-9.5,9.51,9.51,0,0,1,6.79-9.1A1.66,1.66,0,0,0,12,2.81h0a1.67,1.67,0,0,0-1.94-1.64A11,11,0,0,0,12,23Z" />
    </svg>
  );
}
