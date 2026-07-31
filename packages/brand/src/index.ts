/**
 * `@tfd/brand` — design tokens and the runtime-branding machinery.
 *
 * Shared with the mobile app in principle and with the console in practice. The
 * tokens themselves travel unchanged; what differs is the sink (`css.ts`).
 *
 * Nothing here imports React, React Native or `@tfd/domain`.
 */

export * from './colors';
export * from './tokens';
export * from './types';
export * from './createTheme';
export * from './css';
export * from './tenant';
export * from './clients';

import { COLOR_TOKEN_NAMES } from './colors';
import { radius, spacing } from './tokens';

/**
 * The token names a served override may legally address.
 *
 * Passed to `themeOverrideFromWire` so the console can reject a rebrand that
 * names a token this build does not have, instead of writing a dead custom
 * property and reporting success.
 */
export const KNOWN_TOKENS = {
  colorTokens: COLOR_TOKEN_NAMES as readonly string[],
  spacingTokens: Object.keys(spacing) as readonly string[],
  radiusTokens: Object.keys(radius) as readonly string[],
} as const;
