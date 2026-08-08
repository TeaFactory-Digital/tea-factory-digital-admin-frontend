/**
 * The bundled `RuntimeConfig` — what the console renders with before `/config`
 * resolves, and what it falls back to if the call fails.
 *
 * The mobile app's equivalent is `src/config/clients/<id>/index.ts` compiled
 * into the binary. The console's differs in one important way: **it is
 * deliberately generic**. A per-tenant default here would be a second source of
 * truth for the factory's name and telephone number, and a wrong telephone
 * number in a shipped bundle is exactly what serving config was meant to fix.
 *
 * So: neutral identity, everything enabled, empty lists. The brand *colours* do
 * come from a bundled per-tenant fallback (`@tfd/brand`'s registry) because a
 * grey login screen is a visible regression and a colour cannot be wrong in a
 * way that misleads anyone.
 */

import type { RuntimeConfig } from '@tfd/domain';
import { brandForTenant } from '@tfd/brand';
import { BUNDLED_LOGO_URL } from '@/brand/assets';
import { tenantId } from './tenant';

const brand = brandForTenant(tenantId);

export const bundledConfig: RuntimeConfig = {
  tenantId,

  factory: {
    // Not a real factory. The served config replaces every line of this.
    name: brand.displayName,
    telephone: '',
    regNo: '',
    location: '',
  },

  /**
   * Everything on by default.
   *
   * The alternative — default off — hides queues from a clerk whenever `/config`
   * is slow, which reads as "the manure requests have disappeared". Defaulting on
   * risks briefly showing a queue the factory does not use, which reads as an
   * empty inbox. The second failure is the cheaper one.
   *
   * Either way the API is the authority: a call to a disabled surface returns
   * `403 feature-disabled` regardless of what the console rendered (AC-07).
   */
  flags: {
    enableSavings: true,
    enableAdvances: true,
    enableLoans: true,
    enableManure: true,
    enableTeaPackets: true,
    enableInquiry: true,
    enableNews: true,
    enablePushNotifications: true,
    enablePromoBanner: true,

    /**
     * The app-only flags. On for the same reason as the rest, and with **less** at
     * stake: nothing in this console renders behind them, so a wrong default here
     * shows the office a switch in the wrong position for one paint rather than
     * hiding a queue. M14 reads the served value the moment it arrives.
     */
    enableOnboarding: true,
    enableBiometricLogin: true,
    enableDarkModeToggle: true,
    enableProfileTab: true,
    enableAutoLock: true,

    /* v1 console-only flags, gone with M6 and M16's gate:
     *   enablePayouts: true,
     *   enableReports: true,
     */
  },

  savings: { perKgOptions: [] },
  banks: [],

  localization: {
    defaultLanguage: 'en',
    supportedLanguages: ['si', 'en', 'ta'],
    /**
     * The console chrome is English; **editorial content is authored in all
     * three**. That asymmetry is the decision recorded in
     * docs/white-label.md → Localization: office staff work in English, but the
     * si/en/ta tabs in the content editor are not optional, because a Sinhala
     * supplier reading an English-only FAQ is the app failing.
     */
    contentLanguages: ['si', 'en', 'ta'],
  },

  theme: undefined,

  /**
   * The bundled mark is the default logo, for the same reason the bundled palette
   * is the default colour: a mark cannot be *wrong* in a way that misleads
   * anyone, and two grey initials on the login screen of a tea factory is a
   * visible regression. A tenant with its own artwork overrides it through
   * `branding.logoUrl` in `GET /config` (see brand/assets.ts).
   */
  branding: {
    logoUrl: brand.logoUrl ?? BUNDLED_LOGO_URL,
    logoDarkUrl: brand.logoDarkUrl,
  },

  collectionPoints: [],
};
