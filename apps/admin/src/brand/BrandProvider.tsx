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

import { useEffect, useState, type PropsWithChildren } from 'react';
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
import { BUNDLED_LOGO_URL } from './assets';
import { drawnScheme, scaleTypography } from './appearance';
import { LiquidGlassFilter } from './LiquidGlassFilter';
import { useAppearance } from './useAppearance';

/**
 * The scheme and the type scale are now the **reader's**, not the tenant's.
 *
 * This used to be `const CONSOLE_SCHEME = 'light'`, with a note that the dark palette
 * already existed in `@tfd/brand` and turning it on would be "a toggle plus a QA pass, not
 * a refactor". That turned out to be exactly true: `applyTheme` already writes
 * `data-scheme` and `color-scheme`, so this is the toggle.
 *
 * It is read from `localStorage` rather than from `client_config` because §12.1 makes
 * configuration writable by the factory admin alone: see `appearance.ts`.
 */
export function BrandProvider({ children }: PropsWithChildren) {
  const { config } = useRuntimeConfig();
  const { appearance } = useAppearance();
  // Auto is checked once a minute, so the console turns dark at six without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (appearance.scheme !== 'auto') return;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [appearance.scheme]);
  const scheme = drawnScheme(appearance.scheme, now);

  useEffect(() => {
    const bundled = brandForTenant(tenantId);
    // Served over bundled, per token, so a factory that changes only `primary`
    // in M14 keeps the rest of its bundled palette.
    const override = mergeThemeOverrides(
      bundled.theme,
      themeOverrideFromWire(config.theme, KNOWN_TOKENS),
    );

    const theme = scaleTypography(createTheme(scheme, override), appearance.textSize);
    const written = applyTheme(document.documentElement, theme);

    return () => {
      // Not cleared on unmount: removing the properties would leave the page
      // unstyled for a frame. They are overwritten on the next apply, and a
      // tenant switch is a full page load (see config/tenant.ts).
      void written;
    };
  }, [config.theme, scheme, appearance.textSize]);

  // Density and contrast are CSS layers keyed on attributes (`theme.css`).
  useEffect(() => {
    const root = document.documentElement;
    if (appearance.density === 'compact') root.dataset.density = 'compact';
    else delete root.dataset.density;
    if (appearance.contrast === 'high') root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
  }, [appearance.density, appearance.contrast]);

  // The glass effect is a CSS layer keyed on this attribute (`theme.css`), so turning it on
  // re-renders nothing: the sidebar, top bar and dialogs carry `data-glass-surface` always.
  useEffect(() => {
    const root = document.documentElement;
    if (!appearance.glass) {
      delete root.dataset.glass;
      delete root.dataset.glassRefract;
      return;
    }
    root.dataset.glass = 'on';
    // The refraction filter only where `backdrop-filter: url()` renders: Chromium.
    if (isChromium()) root.dataset.glassRefract = 'on';

    // The light on the glass follows the pointer, as it follows the tilt of a phone. One
    // listener, one write per frame, and only while the effect is on.
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--glass-light-x', `${Math.round((event.clientX / window.innerWidth) * 100)}%`);
        root.style.setProperty('--glass-light-y', `${Math.round((event.clientY / window.innerHeight) * 100)}%`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [appearance.glass]);

  // What the glass sits on: an attribute for the CSS, and the photo as a custom property.
  // The estate photograph ships with the console and is fetched only when chosen.
  useEffect(() => {
    const root = document.documentElement;
    const url =
      appearance.backdrop === 'estate'
        ? `${import.meta.env.BASE_URL}backdrops/tea-estate.jpg`
        : appearance.backdrop === 'photo'
          ? appearance.photo
          : null;
    if (appearance.glass && url) {
      root.dataset.glassPhoto = 'on';
      root.style.setProperty('--glass-photo', `url("${url}")`);
    } else {
      delete root.dataset.glassPhoto;
      root.style.removeProperty('--glass-photo');
    }
  }, [appearance.glass, appearance.backdrop, appearance.photo]);

  useEffect(() => {
    const name = config.factory.name?.trim();
    document.title = name ? `${name} · Console` : 'Tea Factory Console';
  }, [config.factory.name]);

  useEffect(() => {
    // Falls back to the bundled mark rather than returning early. `index.html`
    // already points at it, so this is belt and braces, but it is also what
    // restores the default icon if a factory *clears* its `faviconUrl` in M14,
    // which a bail-out here would leave showing the old one until a reload.
    const href = config.branding.faviconUrl?.trim() || BUNDLED_LOGO_URL;
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? createIconLink();
    link.href = href;
  }, [config.branding.faviconUrl]);

  return (
    <>
      {appearance.glass ? <LiquidGlassFilter /> : null}
      {children}
    </>
  );
}

/** Chrome and Edge, where an SVG filter in `backdrop-filter` is drawn. */
function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
  if (brands) return brands.some((one) => one.brand === 'Chromium');
  return /Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
}

function createIconLink(): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
}
