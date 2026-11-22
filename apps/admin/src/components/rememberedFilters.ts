/** What `RememberFilters` keeps, and where: plain functions, tested on their own. */

const NOT_REMEMBERED = new Set(['page', 'month', 'date', 'from', 'to']);

export function storageKey(screen: string, userId: string | undefined): string {
  return `tfd.filters.${userId ?? 'anyone'}.${screen}`;
}

export function rememberedFilters(screen: string, userId?: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(screen, userId));
  } catch {
    return null;
  }
}

/** The filters worth keeping from an address's query string, or `''` for none. */
export function filtersToRemember(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of Array.from(params.keys())) if (NOT_REMEMBERED.has(key)) params.delete(key);
  return params.toString();
}
