/**
 * One look for every Recharts chart in the console.
 *
 * Recessive axes and a hairline grid in the divider colour, so the data is the only
 * thing on the plot with any weight; a tooltip that is a small card rather than the
 * library's default box. Everything through CSS variables, so a chart rebrands with the
 * rest of the console and follows the scheme into dark mode.
 */

/** Spread onto `<XAxis>`. */
export const X_AXIS = {
  stroke: 'var(--color-text-secondary)',
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  tickMargin: 10,
} as const;

/** Spread onto `<YAxis>`. */
export const Y_AXIS = {
  stroke: 'var(--color-text-secondary)',
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  tickMargin: 8,
} as const;

/** Spread onto `<CartesianGrid>`. */
export const GRID = {
  stroke: 'var(--color-divider)',
  vertical: false,
} as const;

/** The hover band behind a bar group. */
export const BAR_CURSOR = { fill: 'var(--color-surface-variant)', opacity: 0.7 } as const;

/** The crosshair on a line or area chart. */
export const LINE_CURSOR = {
  stroke: 'var(--color-text-secondary)',
  strokeWidth: 1,
  strokeDasharray: '3 3',
} as const;

/** A bar is never wider than this, however few there are: the band's leftover is air. */
export const MAX_BAR = 24;

/** The marker on the hovered point: series colour, ringed in the surface colour. */
export function activeDot(color: string) {
  return { r: 5, fill: color, stroke: 'var(--color-surface)', strokeWidth: 2 };
}
