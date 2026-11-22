import type { SupplierListItem } from '@tfd/domain';

/**
 * Which of the search hits the clerk meant.
 *
 * An exact code wins over a prefix, and a prefix only wins when it is the *only* hit.
 * Typing `5` must not silently pick `5007`: a wrong grower recorded with no refusal is the
 * one failure this screen cannot allow.
 */
export function pickMatch(candidates: SupplierListItem[], typed: string): SupplierListItem | null {
  if (candidates.length === 0) return null;
  const wanted = typed.trim().toLowerCase();
  const bare = wanted.replace(/\s*\(.*\)$/, '');
  const exact = candidates.find((c) => {
    const code = c.supplierCode.toLowerCase();
    return code === wanted || code.replace(/\s*\(.*\)$/, '') === bare;
  });
  if (exact) return exact;
  return candidates.length === 1 ? candidates[0]! : null;
}
