/**
 * The factory's mark.
 *
 * Mirrors the mobile app's `<Logo>`, with a three-step fallback so the console
 * never draws a broken image and never draws nothing:
 *
 *   served `branding.logoUrl`  →  the bundled tea mark  →  a themed wordmark
 *
 * The served logo wins, because a factory that uploaded its own artwork in M14
 * expects to see it. The bundled mark is next, so a console with nothing
 * configured still looks like a product. The initials survive as the last resort
 * — that is what lets a new factory be brought live without waiting on artwork,
 * and it is also what a 404'd CDN link degrades to instead of a broken-image
 * glyph in the sidebar.
 */

import { useState } from 'react';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { cn } from '@/lib/cn';
import { BUNDLED_LOGO_URL } from './assets';

/**
 * Three steps, one per place the mark appears at a different job — no spare
 * variants, so there is nothing to pick wrongly.
 *
 * `md` is an icon token, because in the chrome the mark *is* an icon: it sits on
 * the sidebar's baseline next to the factory name and re-scales with everything
 * else if a tenant adjusts `iconSizes`. `lg` and `xl` are off the icon scale
 * deliberately — on the sign-in screen and the splash the mark is the subject
 * rather than a label, and the icon scale tops out at 48, which reads as a doodle
 * above a heading.
 */
const MARK_SIZE = {
  /** Chrome: sidebar, topbar, error screen. */
  md: 'size-icon-xl',
  /** Sign-in, where the mark answers "whose console is this?". */
  lg: 'size-18',
  /** The boot splash. */
  xl: 'size-28',
} as const;

export type LogoSize = keyof typeof MARK_SIZE;

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

export function Logo({
  className,
  showName = true,
  size = 'md',
}: {
  className?: string;
  showName?: boolean;
  size?: LogoSize;
}) {
  const { config } = useRuntimeConfig();
  const name = config.factory.name || 'Tea Factory';
  const served = config.branding.logoUrl?.trim();

  /**
   * Which sources have failed to load, keyed by URL.
   *
   * Keyed rather than a boolean so a rebrand mid-session — `/config` refetched
   * with a new `logoUrl` — gets a fresh attempt without needing an effect to
   * reset the flag. A URL that failed once stays failed; a URL nobody has tried
   * is simply absent.
   */
  const [broken, setBroken] = useState<Record<string, true>>({});

  const src =
    served && !broken[served] ? served : broken[BUNDLED_LOGO_URL] ? null : BUNDLED_LOGO_URL;

  return (
    <span className={cn('flex min-w-0 items-center gap-sm', className)}>
      {src ? (
        <img
          src={src}
          alt=""
          onError={() => setBroken((previous) => ({ ...previous, [src]: true }))}
          // `contain`, because factory logos are every aspect ratio there is
          // (architecture.md §5) and a stretched mark looks like a broken build.
          className={cn('shrink-0 object-contain', MARK_SIZE[size])}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            'numeric flex shrink-0 items-center justify-center rounded-md bg-primary text-caption font-bold text-primary-contrast',
            MARK_SIZE[size],
          )}
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
