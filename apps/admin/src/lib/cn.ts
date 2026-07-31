/**
 * Join class names, dropping falsy values.
 *
 * Deliberately not `tailwind-merge`. Conflict resolution by last-class-wins is a
 * convenience that hides a design problem: if a component's caller needs to
 * override its background, the component should take a variant, not accept
 * arbitrary classes and hope the merge order is right. Every primitive here
 * takes explicit variants and only appends `className` for layout.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
