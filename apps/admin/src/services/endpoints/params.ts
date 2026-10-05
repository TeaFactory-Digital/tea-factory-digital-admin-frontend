/**
 * Query-string assembly, in one place.
 *
 * Drops `undefined`, `null` and `''` rather than sending them. An empty filter
 * is the absence of a filter, and `?status=` reaching the backend as an empty
 * string is how a list quietly returns nothing.
 */
export function toParams(input: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = String(value);
  }
  return out;
}

/**
 * `toParams` for the four request queues (change, credit, tea packet, inquiry), which take
 * no `sort` or `dir`. Their filters are strict on the API: an unknown key is refused with
 * `422 unrecognized_keys` instead of being ignored, so one stray key empties the whole queue.
 * Staging answered exactly that for every queue when the screens still sent a sort.
 */
export function toQueueParams(input: object): Record<string, string> {
  const { sort: _sort, dir: _dir, ...rest } = input as Record<string, unknown>;
  return toParams(rest);
}
