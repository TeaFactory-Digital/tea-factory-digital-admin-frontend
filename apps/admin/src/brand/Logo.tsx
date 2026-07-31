/**
 * The factory's mark.
 *
 * Mirrors the mobile app's `<Logo>`: a served image when the tenant has one, and
 * a **themed wordmark built from the factory name** when it does not. That
 * fallback is what lets a new factory be brought live through M14 without waiting
 * on artwork — "no bundled image files required" is the same promise the app
 * makes.
 */

import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { cn } from '@/lib/cn';

/** `Galaboda Tea Factory` → `GT`. Two letters; three is a monogram, not a mark. */
function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((word) => /^[A-Za-z඀-෿஀-௿]/.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  const { config } = useRuntimeConfig();
  const name = config.factory.name || 'Tea Factory';
  const logoUrl = config.branding.logoUrl;

  return (
    <span className={cn('flex min-w-0 items-center gap-sm', className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          // `contain`, because factory logos are every aspect ratio there is
          // (architecture.md §5) and a stretched mark looks like a broken build.
          className="size-icon-xl shrink-0 object-contain"
        />
      ) : (
        <span
          aria-hidden
          className="numeric flex size-icon-xl shrink-0 items-center justify-center rounded-md bg-primary text-caption font-bold text-primary-contrast"
        >
          {initials(name)}
        </span>
      )}
      {showName ? (
        <span className="min-w-0 truncate text-body-small font-semibold text-text-primary">
          {name}
        </span>
      ) : null}
    </span>
  );
}
