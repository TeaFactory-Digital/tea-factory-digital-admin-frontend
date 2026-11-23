/**
 * A short celebration when the month is published (23 November 2026): a check mark and a
 * burst of the factory's colours, gone in under two seconds. It is the biggest job of the
 * month and the office should feel it land; the toast says it in words.
 *
 * Decoration only: hidden from assistive technology, never in the way of a click, and for
 * reduced motion just the check mark, held still for a moment.
 */

import { useEffect, useMemo, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/navigate';

const COLOURS = ['bg-primary', 'bg-secondary', 'bg-success', 'bg-warning', 'bg-info'];
const PIECES = 28;
const SHOWN_MS = 1800;

export function Celebration({ onDone }: { onDone: () => void }) {
  const still = prefersReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onDone, still ? 1000 : SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [onDone, still]);

  // Spread evenly round the circle with a little chance in each, fixed for this burst.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => {
        const angle = (index / PIECES) * Math.PI * 2 + Math.random() * 0.3;
        const distance = 140 + Math.random() * 120;
        return {
          colour: COLOURS[index % COLOURS.length]!,
          style: {
            '--dx': `${Math.cos(angle) * distance}px`,
            '--dy': `${Math.sin(angle) * distance}px`,
            '--spin': `${Math.round(Math.random() * 540 - 270)}deg`,
            animationDelay: `${Math.round(Math.random() * 80)}ms`,
          } as CSSProperties,
        };
      }),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" data-celebration>
      {still
        ? null
        : pieces.map((piece, index) => (
            <span key={index} className={`tfd-confetti absolute size-2 rounded-sm ${piece.colour}`} style={piece.style} />
          ))}
      <span className="tfd-celebrate-check flex size-20 items-center justify-center rounded-full bg-success text-on-status shadow-raised">
        <Check className="size-10" strokeWidth={3} />
      </span>
    </div>
  );
}
