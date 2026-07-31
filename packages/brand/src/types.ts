import type { ColorSchemeName, ColorTokens } from './colors';
import type { IconSizes, Radius, Spacing, Typography } from './tokens';

/** A fully-resolved theme: base tokens + the active tenant's overrides. */
export interface Theme {
  scheme: ColorSchemeName;
  dark: boolean;
  colors: ColorTokens;
  spacing: Spacing;
  radius: Radius;
  iconSizes: IconSizes;
  typography: Typography;
}

/**
 * Partial overrides a tenant may provide. Everything optional — anything
 * omitted falls back to the base tokens, exactly as `createTheme` does on mobile.
 */
export interface ThemeOverride {
  colors?: {
    light?: Partial<ColorTokens>;
    dark?: Partial<ColorTokens>;
  };
  typography?: {
    fontFamily?: Partial<Typography['fontFamily']>;
    variants?: Partial<Typography['variants']>;
  };
  spacing?: Partial<Spacing>;
  radius?: Partial<Radius>;
  iconSizes?: Partial<IconSizes>;
}

/**
 * The bundled brand fallback for one tenant.
 *
 * The console resolves its brand at **runtime** from `GET /config`, so this is
 * not the source of truth the way a mobile client config is. It is the value the
 * login screen renders with **before** the config fetch resolves, and the value
 * `npm run dev` uses with no backend at all. Same pattern as the app:
 * *bundled value is the default, served value overrides it, and the UI never
 * blocks on the fetch.*
 */
export interface BrandConfig {
  /** Matches the subdomain: `galaboda.admin.teafactory.lk` → `galaboda`. */
  tenantId: string;
  /** Shown on the login screen before `/config` arrives. */
  displayName: string;
  theme: ThemeOverride;
  /** Absolute or app-relative URL. Absent → the themed wordmark fallback. */
  logoUrl?: string;
  logoDarkUrl?: string;
}

export type { ColorSchemeName, ColorTokens };
