import { baseColors, type ColorSchemeName } from './colors';
import { iconSizes, radius, spacing, typography } from './tokens';
import type { Theme, ThemeOverride } from './types';

/**
 * Resolve a concrete `Theme` by merging base design tokens with a tenant's
 * overrides — the single choke-point that produces every colour, size and
 * typographic value the console uses, which is exactly why nothing else may
 * hardcode them.
 *
 * Identical in shape and behaviour to the mobile app's `createTheme`. The only
 * difference is what happens next: mobile hands the result to a `ThemeProvider`
 * for `useTheme()`, the console hands it to `themeToCssVars` (see `css.ts`).
 */
export function createTheme(scheme: ColorSchemeName, override?: ThemeOverride): Theme {
  const colorOverride = override?.colors?.[scheme] ?? {};

  return {
    scheme,
    dark: scheme === 'dark',
    colors: { ...baseColors[scheme], ...colorOverride },
    spacing: { ...spacing, ...override?.spacing },
    radius: { ...radius, ...override?.radius },
    iconSizes: { ...iconSizes, ...override?.iconSizes },
    typography: {
      fontFamily: { ...typography.fontFamily, ...override?.typography?.fontFamily },
      variants: { ...typography.variants, ...override?.typography?.variants },
    },
  };
}

/**
 * Merge two overrides, right-hand side winning per token.
 *
 * This is how the served `/config` theme layers over the bundled tenant
 * fallback: the tenant may ship a full palette in the binary and the office may
 * later change only `primary` from M14 without the rest reverting to base.
 */
export function mergeThemeOverrides(base: ThemeOverride, over?: ThemeOverride): ThemeOverride {
  if (!over) return base;
  return {
    colors: {
      light: { ...base.colors?.light, ...over.colors?.light },
      dark: { ...base.colors?.dark, ...over.colors?.dark },
    },
    typography: {
      fontFamily: { ...base.typography?.fontFamily, ...over.typography?.fontFamily },
      variants: { ...base.typography?.variants, ...over.typography?.variants },
    },
    spacing: { ...base.spacing, ...over.spacing },
    radius: { ...base.radius, ...over.radius },
    iconSizes: { ...base.iconSizes, ...over.iconSizes },
  };
}
