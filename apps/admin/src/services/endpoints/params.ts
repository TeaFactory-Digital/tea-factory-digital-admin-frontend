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
