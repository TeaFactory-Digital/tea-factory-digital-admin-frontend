/**
 * A whole split into parts, with the parts listed beside it.
 *
 * **The legend is not optional.** It carries every label and figure in text, which is
 * what makes the ring readable for a colour-blind reader, for three light series colours
 * that sit under 3:1 against the card, and for a clerk reading figures aloud who cannot
 * hover. The ring is the shape; the list is the record.
 *
 * Hovering a segment or a legend row highlights the pair, so either one finds the other.
 * Segments are separated by a 2 px gap in the surface colour rather than by a stroke.
 */

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** A CSS colour, normally from `seriesColor`. */
  color: string;
}

const SIZE = 160;
const RADIUS = 62;
const THICKNESS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The surface-coloured gap between segments, along the ring. */
const GAP = 2.5;

export function DonutChart({
  segments,
  total,
  totalLabel,
  formatValue,
  showShare = true,
  label,
}: {
  segments: DonutSegment[];
  /** The figure in the hole, already formatted. */
  total: ReactNode;
  totalLabel: ReactNode;
  formatValue: (value: number) => string;
  /** Off when a single segment would print a meaningless 100%. */
  showShare?: boolean;
  /** The accessible name of the figure. */
  label: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sum = segments.reduce((acc, segment) => acc + segment.value, 0);
  const gap = segments.length > 1 ? GAP : 0;

  let offset = 0;
  const arcs = segments.map((segment) => {
    const length = sum > 0 ? (segment.value / sum) * CIRCUMFERENCE : 0;
    const arc = { ...segment, dash: Math.max(0, length - gap), offset };
    offset += length;
    return arc;
  });

  return (
    <figure aria-label={label} className="flex flex-col gap-lg">
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-40 overflow-visible"
          role="img"
          aria-label={label}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-surface-variant)"
            strokeWidth={THICKNESS}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={active === arc.key ? THICKNESS + 4 : THICKNESS}
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
              strokeDashoffset={-arc.offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              opacity={active && active !== arc.key ? 0.35 : 1}
              className="cursor-default transition-[stroke-width,opacity] duration-200"
              onMouseEnter={() => setActive(arc.key)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${arc.label}: ${formatValue(arc.value)}`}</title>
            </circle>
          ))}
          <text
            x={SIZE / 2}
            y={SIZE / 2 - 2}
            textAnchor="middle"
            className="numeric fill-text-primary text-h3 font-semibold"
          >
            {total}
          </text>
          <text
            x={SIZE / 2}
            y={SIZE / 2 + 18}
            textAnchor="middle"
            className="fill-text-secondary text-caption"
          >
            {totalLabel}
          </text>
        </svg>
      </div>

      <ul className="flex flex-col gap-xxs">
        {arcs.map((arc) => (
          <li
            key={arc.key}
            onMouseEnter={() => setActive(arc.key)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              '-mx-sm flex items-center gap-sm rounded-sm px-sm py-xs text-body-small transition-colors duration-150',
              active === arc.key && 'bg-surface-variant',
            )}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: arc.color }}
            />
            <span className="min-w-0 flex-1 truncate text-text-primary">{arc.label}</span>
            {showShare && sum > 0 ? (
              <span className="numeric text-text-secondary">
                {Math.round((arc.value / sum) * 100)}%
              </span>
            ) : null}
            <span className="numeric min-w-10 text-right font-semibold text-text-primary">
              {formatValue(arc.value)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
