/**
 * Applies the resolved brand to the document.
 *
 * Three things happen here, and all three are the console's answer to something
 * the mobile app gets from its binary:
 *
 *  1. **Theme → CSS custom properties.** The app hands a `Theme` to React
 *     context; the console writes `--brand-*` onto `documentElement` so Tailwind's
 *     build-time tokens resolve to runtime values.
 *  2. **The document title.** A per-brand binary has its name in `Info.plist`.
 *     One bundle serving every tenant has to set it, or every factory's browser
 *     tab reads "Tea Factory Console".
 *  3. **The favicon**, for the same reason. An office with four consoles open
 *     picks the tab by its icon.
 *
 * The bundled tenant fallback is applied synchronously in `main.tsx` before the
 * first render; this component's job is to re-apply once `/config` lands, which
 * is the only way a rebrand from M14 reaches a running console without a deploy.
 */

import { useEffect, type PropsWithChildren } from 'react';
import {
  KNOWN_TOKENS,
  applyTheme,
  brandForTenant,
  createTheme,
  mergeThemeOverrides,
  themeOverrideFromWire,
} from '@tfd/brand';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { tenantId } from '@/config/tenant';

/**
 * Light only, for now.
 *
 * The dark palette exists in `@tfd/brand` and the bridge emits whichever scheme
 * it is given, so switching this on later is a toggle plus a QA pass — not a
 * refactor. It is off because the console runs on office desktops in daylight
 * and doubling the theming QA buys nothing in the field. Recorded as a decision
 * in docs/design-system.md rather than left as an omission.
 */
const CONSOLE_SCHEME = 'light' as const;

export function BrandProvider({ children }: PropsWithChildren) {
  const { config } = useRuntimeConfig();

  useEffect(() => {
    const bundled = brandForTenant(tenantId);
    // Served over bundled, per token — so a factory that changes only `primary`
    // in M14 keeps the rest of its bundled palette.
    const override = mergeThemeOverrides(
      bundled.theme,
      themeOverrideFromWire(config.theme, KNOWN_TOKENS),
    );

    const theme = createTheme(CONSOLE_SCHEME, override);
    const written = applyTheme(document.documentElement, theme);

    return () => {
      // Not cleared on unmount: removing the properties would leave the page
      // unstyled for a frame. They are overwritten on the next apply, and a
      // tenant switch is a full page load (see config/tenant.ts).
      void written;
    };
  }, [config.theme]);

  useEffect(() => {
    const name = config.factory.name?.trim();
    document.title = name ? `${name} — Console` : 'Tea Factory Console';
  }, [config.factory.name]);

  useEffect(() => {
    const href = config.branding.faviconUrl;
    if (!href) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? createIconLink();
    link.href = href;
  }, [config.branding.faviconUrl]);

  return <>{children}</>;
}

function createIconLink(): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
}
