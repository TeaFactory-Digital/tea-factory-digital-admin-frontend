/**
 * The tooltip and legend every Recharts chart in the console shares. The axis and grid
 * presets they pair with are in `rechartsTheme.ts`.
 */

import type { ReactNode } from 'react';

interface TooltipEntry {
  name?: ReactNode;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
}

/**
 * `<Tooltip content={<ChartTooltip … />} />`.
 *
 * Recharts injects `active`, `payload` and `label`; the caller supplies how to print
 * them. The value is in text ink and the series is a swatch beside it, never coloured
 * text: a light series hue is illegible as type on a white card.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = (value) => String(value),
  formatLabel = (value) => String(value),
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: unknown;
  formatValue?: (value: number | null) => string;
  formatLabel?: (label: unknown) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-36 rounded-md border border-border bg-surface px-md py-sm shadow-raised">
      <p className="mb-xs text-caption font-medium text-text-secondary">{formatLabel(label)}</p>
      <ul className="flex flex-col gap-xxs">
        {payload.map((entry, index) => (
          <li
            key={String(entry.dataKey ?? index)}
            className="flex items-center gap-sm text-body-small"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            {payload.length > 1 ? (
              <span className="min-w-0 flex-1 text-text-secondary">{entry.name}</span>
            ) : null}
            <span className="numeric ml-auto font-semibold text-text-primary">
              {formatValue(entry.value == null ? null : Number(entry.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A legend for a multi-series chart: swatch, then the name in text ink. */
export function ChartLegend({
  items,
}: {
  items: Array<{ key: string; label: string; color: string }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-md text-caption text-text-secondary">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-xs">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
