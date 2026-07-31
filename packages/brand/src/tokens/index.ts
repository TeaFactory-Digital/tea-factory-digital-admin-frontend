/**
 * Scale tokens, ported from the mobile app.
 *
 * **Unitless on purpose.** The values are the same numbers the React Native app
 * uses as dp; `css.ts` is the single place that decides they mean px on the web
 * (admin-console.md → "`src/theme` needs a translation layer for the web").
 * Keeping them unitless is what lets both platforms share one source.
 */

/* ───────────────────────────────── Spacing ───────────────────────────────── */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
} as const;

export type SpacingToken = keyof typeof spacing;
export type Spacing = Record<SpacingToken, number>;

/* ───────────────────────────────── Radius ───────────────────────────────── */

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
export type Radius = Record<RadiusToken, number>;

/* ─────────────────────────────── Icon sizes ─────────────────────────────── */

export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type IconSizeToken = keyof typeof iconSizes;
export type IconSizes = Record<IconSizeToken, number>;

/* ─────────────────────────────── Typography ─────────────────────────────── */

export type FontFamilyKey = 'regular' | 'medium' | 'semibold' | 'bold';

export interface FontFamilyTokens {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
}

export interface TypographyVariant {
  fontFamily: FontFamilyKey;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  /** Numeric, so it is valid CSS and valid React Native alike. */
  fontWeight: number;
}

/**
 * The app's variants, plus `dataCell` and `dataHeader`.
 *
 * The console is mostly grids, and a grid needs a size below `bodySmall` that
 * is still readable at a glance across a 12-column row. Adding it as a token
 * beats every table reaching for `text-[13px]`.
 */
export type TypographyVariantName =
  | 'displayLarge'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'bodySmall'
  | 'label'
  | 'button'
  | 'caption'
  | 'overline'
  | 'dataCell'
  | 'dataHeader';

export type TypographyVariants = Record<TypographyVariantName, TypographyVariant>;

/**
 * Web default stack. The app resolves `System`; a browser needs the list
 * spelled out, and Sinhala/Tamil need a script fallback or the office sees
 * tofu boxes in the content editor.
 */
export const defaultFontFamily: FontFamilyTokens = {
  regular:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Sinhala', 'Noto Sans Tamil', sans-serif",
  medium:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Sinhala', 'Noto Sans Tamil', sans-serif",
  semibold:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Sinhala', 'Noto Sans Tamil', sans-serif",
  bold: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Sinhala', 'Noto Sans Tamil', sans-serif",
};

/**
 * Tabular figures for money and kilos. A column of amounts whose digits do not
 * line up is a column a clerk cannot scan for a mistyped kilo.
 */
export const numericFontFeatures = "'tnum' 1, 'lnum' 1";

export const typographyVariants: TypographyVariants = {
  displayLarge: { fontFamily: 'bold', fontSize: 40, lineHeight: 48, letterSpacing: -0.5, fontWeight: 700 },
  h1: { fontFamily: 'bold', fontSize: 32, lineHeight: 40, letterSpacing: -0.3, fontWeight: 700 },
  h2: { fontFamily: 'bold', fontSize: 26, lineHeight: 34, letterSpacing: -0.2, fontWeight: 700 },
  h3: { fontFamily: 'semibold', fontSize: 22, lineHeight: 30, fontWeight: 600 },
  title: { fontFamily: 'semibold', fontSize: 18, lineHeight: 26, fontWeight: 600 },
  subtitle: { fontFamily: 'medium', fontSize: 16, lineHeight: 24, fontWeight: 500 },
  body: { fontFamily: 'regular', fontSize: 16, lineHeight: 24, fontWeight: 400 },
  bodyStrong: { fontFamily: 'semibold', fontSize: 16, lineHeight: 24, fontWeight: 600 },
  bodySmall: { fontFamily: 'regular', fontSize: 14, lineHeight: 20, fontWeight: 400 },
  label: { fontFamily: 'medium', fontSize: 14, lineHeight: 20, fontWeight: 500 },
  button: { fontFamily: 'semibold', fontSize: 16, lineHeight: 22, letterSpacing: 0.2, fontWeight: 600 },
  caption: { fontFamily: 'regular', fontSize: 12, lineHeight: 16, fontWeight: 400 },
  overline: { fontFamily: 'medium', fontSize: 11, lineHeight: 16, letterSpacing: 1, fontWeight: 500 },
  dataCell: { fontFamily: 'regular', fontSize: 13, lineHeight: 18, fontWeight: 400 },
  dataHeader: { fontFamily: 'semibold', fontSize: 12, lineHeight: 16, letterSpacing: 0.3, fontWeight: 600 },
};

export interface Typography {
  fontFamily: FontFamilyTokens;
  variants: TypographyVariants;
}

export const typography: Typography = {
  fontFamily: defaultFontFamily,
  variants: typographyVariants,
};
