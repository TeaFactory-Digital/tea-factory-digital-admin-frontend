/**
 * A dashboard figure that counts up to its value (23 November 2026): from 0 when the screen
 * opens, and from the old figure to the new one when it changes, so the eye catches that a
 * number moved. Under a second, eased, and drawn with the figure's own formatting.
 *
 * Instant when animations are switched off (`lib/motion.ts`), and in tests. The text is the final
 * figure for assistive technology from the first frame of each change, because the element is
 * not a live region: nothing reads the in-between numbers aloud.
 */

import { useEffect, useRef, useState } from 'react';
import { MOTION_MS, motionAllowed } from '@/lib/motion';

const DURATION_MS = MOTION_MS.count;

export function CountUp({
  value,
  format,
  animate = import.meta.env.MODE !== 'test' && motionAllowed(),
  fromZero = true,
}: {
  value: number;
  format: (value: number) => string;
  animate?: boolean;
  /**
   * Count up from 0 when it first appears (a headline figure), or start at the value and
   * count only when it changes (a badge that is on every screen: 26 November 2026).
   */
  fromZero?: boolean;
}) {
  const [shown, setShown] = useState(animate && fromZero ? 0 : value);
  const from = useRef(animate && fromZero ? 0 : value);

  useEffect(() => {
    if (!animate) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      setShown(origin + (value - origin) * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    });
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, animate]);

  // Whole numbers stay whole on the way up; a percentage keeps its own rounding in `format`.
  const display = Number.isInteger(value) ? Math.round(shown) : shown;
  return <span className="numeric">{format(display)}</span>;
}
