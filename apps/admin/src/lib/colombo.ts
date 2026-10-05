/** `2026-10-06T08:00` (Colombo) → `2026-10-06T08:00:00+05:30`. Sri Lanka has no DST. */
export function colomboLocalToInstant(local: string): string {
  return `${local}:00+05:30`;
}
