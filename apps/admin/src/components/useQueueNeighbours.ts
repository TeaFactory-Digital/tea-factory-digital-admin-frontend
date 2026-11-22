/**
 * The pending items either side of the one on screen, for J and K and for moving on after a
 * decision (22 November 2026). The queue is oldest first, as the list shows it.
 */

export function queueNeighbours(ids: string[], current: string | undefined): { next?: string; previous?: string } {
  const index = current ? ids.indexOf(current) : -1;
  if (index < 0) return { next: ids[0] };
  return { next: ids[index + 1], previous: index > 0 ? ids[index - 1] : undefined };
}
