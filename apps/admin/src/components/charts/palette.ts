/**
 * The categorical series colours, as CSS variables, in their fixed order.
 *
 * Assigned **by entity, never by rank**: a caller maps each category to a slot from a
 * fixed list of its own keys, so a queue keeps its colour when another queue empties and
 * drops out of the chart. Five slots, validated as a set for colour-blind separation (see
 * `chart1` in `@tfd/brand`). A sixth category is not a sixth hue. It folds into
 * {@link OTHER_SERIES}, and the legend beside the chart still names it.
 */
export const SERIES = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const;

/** Everything past the fifth slot: neutral, so it never reads as a sixth series. */
export const OTHER_SERIES = 'var(--color-disabled)';

/** The slot for the `index`-th key of a caller's fixed key list. */
export function seriesColor(index: number): string {
  return SERIES[index] ?? OTHER_SERIES;
}
