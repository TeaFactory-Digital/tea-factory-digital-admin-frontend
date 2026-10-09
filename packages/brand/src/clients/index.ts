/**
 * Bundled brand fallbacks, one per tenant.
 *
 * **This registry is not the source of truth.** The console resolves its brand
 * at runtime from `GET /config`; these are the values rendered before that
 * fetch resolves, and the values `npm run dev` uses with no backend at all.
 * Same rule as the app: *bundled value is the default, served value overrides
 * it, and the UI never blocks on the fetch*: a login screen that waited for a
 * network round trip to draw a logo would turn a bad connection into a broken
 * console.
 *
 * The tenant ids match the deployment subdomains:
 *
 * ```
 * galaboda.admin.teafactory.lk    ─┐
 * <factory>.admin.teafactory.lk    ├─► same static bundle ─► GET /config per subdomain
 * <factory>.admin.teafactory.lk   ─┘
 * ```
 *
 * A new factory is a DNS record and a `client_config` row. Adding it here is
 * optional polish: an unknown tenant falls back to `base`, fetches its config
 * and brands itself correctly one paint later.
 */

import type { BrandConfig } from '../types';

/**
 * The unbranded fallback: base tokens, no overrides.
 *
 * Deliberately not a copy of Galaboda. An unknown subdomain showing another
 * factory's green would be worse than showing none: a clerk would not notice
 * they were pointed at the wrong deployment.
 */
export const baseBrand: BrandConfig = {
  tenantId: 'base',
  displayName: 'Tea Factory Digital',
  theme: {},
};

/** Factory #1: Galaboda Tea Factory, Akuressa. Mobile's `default` client. */
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

export const brands: Record<string, BrandConfig> = {
  base: baseBrand,
  galaboda,
};

/** Bundled fallback for a tenant, or the neutral base for one we do not know. */
export function brandForTenant(tenantId: string | null | undefined): BrandConfig {
  if (!tenantId) return baseBrand;
  return brands[tenantId] ?? baseBrand;
}
