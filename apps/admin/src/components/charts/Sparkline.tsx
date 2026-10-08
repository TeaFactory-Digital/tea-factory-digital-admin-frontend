/**
 * A twelve-point trend beside a figure, with no axes.
 *
 * Decorative to assistive technology: the figure and the delta beside it say what the
 * line shows, and the full series is on the chart further down the page.
 *
 * `null` **breaks the line** rather than being joined across or drawn at zero, the same
 * rule the adoption chart follows: a month with no requests has no share (BR-102), and a
 * line through it would report a trend the records do not contain.
 */

import { useId } from 'react';
import { cn } from '@/lib/cn';

const WIDTH = 120;
const HEIGHT = 36;

export function Sparkline({
  values,
  domain,
  className,
}: {
  values: Array<number | null>;
  /** Fixed `[min, max]`; otherwise the series' own range. */
  domain?: [number, number];
  className?: string;
}) {
  const id = useId();
  // Months before the first answer are not gaps in a trend, they are before it began;
  // trimmed so a young series fills the tile instead of huddling at its right edge.
  const first = values.findIndex((value) => value !== null);
  const series = first > 0 ? values.slice(first) : values;
  const known = series.filter((value): value is number => value !== null);
  if (known.length < 2) return null;

  const [min, max] = domain ?? [Math.min(...known), Math.max(...known)];
  const span = max - min || 1;
  const step = series.length > 1 ? WIDTH / (series.length - 1) : 0;
  const x = (index: number) => index * step;
  // 3 px of headroom top and bottom so the 2 px line is never clipped at an extreme.
  const y = (value: number) => HEIGHT - 3 - ((value - min) / span) * (HEIGHT - 6);

  // Consecutive runs of known points, each its own line and wash.
  const runs: Array<Array<[number, number]>> = [];
  series.forEach((value, index) => {
    if (value === null) {
      runs.push([]);
      return;
    }
    if (runs.length === 0) runs.push([]);
    runs[runs.length - 1]!.push([x(index), y(value)]);
  });
  const drawn = runs.filter((run) => run.length > 0);

  const lastIndex = series.length - 1 - [...series].reverse().findIndex((value) => value !== null);
  const last = series[lastIndex] as number;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('h-9 w-28 shrink overflow-visible text-primary', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity={0.2} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {drawn.map((run, index) => {
        const line = run
          .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`)
          .join('');
        const area = `${line}L${run[run.length - 1]![0].toFixed(1)},${HEIGHT}L${run[0]![0].toFixed(1)},${HEIGHT}Z`;
        return (
          <g key={index}>
            {run.length > 1 ? <path d={area} fill={`url(#${id})`} /> : null}
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      <circle
        cx={x(lastIndex)}
        cy={y(last)}
        r={3}
        fill="currentColor"
        stroke="var(--color-surface)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
