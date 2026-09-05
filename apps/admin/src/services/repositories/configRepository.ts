/**
 * The served tenant config, merged over the bundled defaults.
 *
 * The pattern is the app's, one layer deeper: **bundled value is the default,
 * served value overrides it, and the UI never blocks on the fetch.** A console
 * that cannot reach `/config` still signs a clerk in and still works — it is
 * simply not branded, and says so.
 *
 * ```
 * bundled defaults  ──►┐
 *                      ├─► merged RuntimeConfig ─► RuntimeConfigProvider
 * served /config    ──►┘
 * ```
 */

import { featureFlagPatchSchema, type FeatureFlagSet, type RuntimeConfig } from '@tfd/domain';
import { configEndpoints } from '../endpoints/config';
import { bundledConfig } from '@/config/defaults';

/**
 * The served flag block, with anything this build does not understand removed.
 *
 * `flags` is the one part of `/config` that drives whether whole modules render, and it
 * arrives from a server that may be a release ahead. Unknown keys are **stripped rather
 * than refused** so a fifteenth flag does not cost us the other fourteen — that is the
 * forward-compatible half, and it is why the schema is not `.strict()` here.
 *
 * A block that fails outright — a flag sent as `"true"` rather than `true`, say — falls
 * back to the bundled defaults rather than being half-applied. Defaults are all-on, which
 * `config/defaults.ts` argues for at length: briefly showing a queue the factory does not
 * use is a cheaper wrong than hiding one it does.
 */
function servedFlags(served: Partial<FeatureFlagSet> | undefined): Partial<FeatureFlagSet> {
  if (!served) return {};
  const parsed = featureFlagPatchSchema.safeParse(served);
  return parsed.success ? parsed.data : {};
}

/**
 * Merge served over bundled, one level deep per block.
 *
 * Deliberately not a deep merge: `flags` and `banks` are replaced wholesale
 * because a served flag set is the complete answer, and a deep-merged bank list
 * would keep branches the factory has removed.
 */
function merge(served: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    ...bundledConfig,
    ...served,
    factory: { ...bundledConfig.factory, ...served.factory },
    flags: { ...bundledConfig.flags, ...servedFlags(served.flags) },
    savings: served.savings ?? bundledConfig.savings,
    banks: served.banks ?? bundledConfig.banks,
    localization: { ...bundledConfig.localization, ...served.localization },
    branding: { ...bundledConfig.branding, ...served.branding },
    collectionPoints: served.collectionPoints ?? bundledConfig.collectionPoints,
  };
}

export const configRepository = {
  /**
   * Never throws. A failed fetch resolves to the bundled config with
   * `degraded: true`, so the shell can show one honest line — "showing bundled
   * defaults" — instead of an error page where a working console should be.
   */
  get: async (): Promise<{ config: RuntimeConfig; degraded: boolean }> => {
    try {
      const served = await configEndpoints.get();
      return { config: merge(served), degraded: false };
    } catch {
      return { config: bundledConfig, degraded: true };
    }
  },
};
