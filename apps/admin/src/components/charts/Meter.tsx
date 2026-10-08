/**
 * A share of a whole, as a bar.
 *
 * The track is a lighter step of the fill's own hue rather than a grey, so the bar reads
 * as one object at any value, including near zero (dataviz: meters).
 */

import { cn } from '@/lib/cn';

export function Meter({
  value,
  label,
  className,
}: {
  /** 0–1. Clamped, so a rounding overshoot cannot draw past the track. */
  value: number;
  /** The accessible name; the visible figure is the caller's to print. */
  label: string;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-primary/15', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
