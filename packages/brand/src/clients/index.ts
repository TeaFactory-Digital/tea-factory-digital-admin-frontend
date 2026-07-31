/**
 * Bundled brand fallbacks, one per tenant.
 *
 * **This registry is not the source of truth.** The console resolves its brand
 * at runtime from `GET /config`; these are the values rendered before that
 * fetch resolves, and the values `npm run dev` uses with no backend at all.
 * Same rule as the app: *bundled value is the default, served value overrides
 * it, and the UI never blocks on the fetch* — a login screen that waited for a
 * network round trip to draw a logo would turn a bad connection into a broken
 * console.
 *
 * The tenant ids match the deployment subdomains:
 *
 * ```
 * galaboda.admin.teafactory.lk    ─┐
 * hillcountry.admin.teafactory.lk  ├─► same static bundle ─► GET /config per subdomain
 * highland.admin.teafactory.lk    ─┘
 * ```
 *
 * A new factory is a DNS record and a `client_config` row. Adding it here is
 * optional polish — an unknown tenant falls back to `base`, fetches its config
 * and brands itself correctly one paint later.
 */

import type { BrandConfig } from '../types';

/**
 * The unbranded fallback: base tokens, no overrides.
 *
 * Deliberately not a copy of Galaboda. An unknown subdomain showing another
 * factory's green would be worse than showing none — a clerk would not notice
 * they were pointed at the wrong deployment.
 */
export const baseBrand: BrandConfig = {
  tenantId: 'base',
  displayName: 'Tea Factory Digital',
  theme: {},
};

/** Factory #1 — Galaboda Tea Factory, Akuressa. Mobile's `default` client. */
export const galaboda: BrandConfig = {
  tenantId: 'galaboda',
  displayName: 'Galaboda Tea Factory',
  theme: {
    colors: {
      light: {
        primary: '#2E8B57',
        primaryContrast: '#FFFFFF',
        primaryMuted: '#DCEEE2',
        secondary: '#8FC13F',
        secondaryContrast: '#12300B',
        focusRing: '#1F6B41',
      },
      dark: {
        primary: '#5FBE7E',
        primaryContrast: '#06210F',
        primaryMuted: '#123222',
        secondary: '#A6D45C',
        secondaryContrast: '#12300B',
        focusRing: '#8FE0A8',
      },
    },
  },
};

/** Mobile's `clientA`. Deep-green + gold, and a softer corner radius. */
export const hillcountry: BrandConfig = {
  tenantId: 'hillcountry',
  displayName: 'Hill Country Tea Factory (Pvt) Ltd',
  theme: {
    colors: {
      light: {
        primary: '#1B5E20',
        primaryContrast: '#FFFFFF',
        primaryMuted: '#D8E8D9',
        secondary: '#C9A227',
        secondaryContrast: '#231A00',
        focusRing: '#14471A',
      },
      dark: {
        primary: '#66BB6A',
        primaryContrast: '#06210B',
        primaryMuted: '#12321A',
        secondary: '#E0C158',
        secondaryContrast: '#231A00',
        focusRing: '#93D996',
      },
    },
    radius: { md: 12, lg: 18 },
  },
};

/** Mobile's `clientB` — the reference for a reduced feature set. */
export const highland: BrandConfig = {
  tenantId: 'highland',
  displayName: 'Highland Estate Tea',
  theme: {
    colors: {
      light: {
        primary: '#00695C',
        primaryContrast: '#FFFFFF',
        primaryMuted: '#CDE5E1',
        secondary: '#FFB300',
        secondaryContrast: '#2A1D00',
        focusRing: '#004D44',
      },
      dark: {
        primary: '#4DB6AC',
        primaryContrast: '#04231F',
        primaryMuted: '#0E2E2B',
        secondary: '#FFCA45',
        secondaryContrast: '#2A1D00',
        focusRing: '#7FD6CD',
      },
    },
  },
};

export const brands: Record<string, BrandConfig> = {
  base: baseBrand,
  galaboda,
  hillcountry,
  highland,
};

/** Bundled fallback for a tenant, or the neutral base for one we do not know. */
export function brandForTenant(tenantId: string | null | undefined): BrandConfig {
  if (!tenantId) return baseBrand;
  return brands[tenantId] ?? baseBrand;
}
