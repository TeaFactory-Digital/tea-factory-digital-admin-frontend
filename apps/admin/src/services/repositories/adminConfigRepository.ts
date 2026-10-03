/**
 * M14 gateway.
 *
 * The guard here is the one that matters most in the whole layer, because a config save is
 * the only edit in the console that can **turn another module off**. So the impact rules run
 * before anything leaves the browser — using `configImpact` from `@tfd/domain`, the same
 * function the API refuses with. Two implementations of "you cannot hide a savings balance"
 * would drift, and the drift would show up as the console warning about one thing while the
 * server refuses on another.
 */

import {
  configImpact,
  isConfigPatchAllowed,
  type ConfigImpact,
  type ConfigPatch,
  type ConfigUsage,
  type RuntimeConfig,
} from '@tfd/domain';
import { adminConfigEndpoints, type AdminConfigResponse } from '../endpoints/adminConfig';
import { ApiError } from '../api/errors';

/** The shape `configImpact` needs from the config it is judging a patch against. */
function currentOf(config: RuntimeConfig) {
  return {
    flags: config.flags,
    collectionPoints: config.collectionPoints,
    banks: config.banks,
    contentLanguages: config.localization.contentLanguages,
  };
}

export const adminConfigRepository = {
  /**
   * One request. It was two while `GET /admin/config` omitted the factory identity and the
   * collection points (**G-16**) and they had to be filled from the public projection of
   * the same row; the API carries the whole row now.
   */
  /**
   * **`null` JSON columns are turned into absences here.**
   *
   * `branding`, `theme` and `push` are nullable `Json` columns, and a factory that never
   * set them is served `null` for each. The type, and every screen, reads `branding` as an
   * object, so `branding.logoUrl` threw and took the whole Languages & branding section
   * down. An empty `branding` and an absent `theme` / `push` are what "never set" means.
   */
  get: async (): Promise<AdminConfigResponse> => {
    const served = await adminConfigEndpoints.get();
    const config = served.config as RuntimeConfig & {
      branding: RuntimeConfig['branding'] | null;
      theme?: RuntimeConfig['theme'] | null;
      push?: RuntimeConfig['push'] | null;
    };
    const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
    const savings = (config.savings ?? {}) as Partial<RuntimeConfig['savings']>;
    const usage = (served.usage ?? {}) as Partial<ConfigUsage>;

    return {
      ...served,
      config: {
        ...config,
        branding: config.branding ?? {},
        theme: config.theme ?? undefined,
        push: config.push ?? undefined,
        /*
         * The same rule for the lists and the savings block every section maps over: a
         * value that is missing or not a list reads as empty, never as a crash. A section
         * that called `.map` on `undefined` replaced the whole Configuration screen with
         * "This screen could not be shown".
         */
        savings: { ...savings, perKgOptions: list<number>(savings.perKgOptions) },
        collectionPoints: list<RuntimeConfig['collectionPoints'][number]>(config.collectionPoints),
        banks: list<RuntimeConfig['banks'][number]>(config.banks),
        manureProducts: Array.isArray(config.manureProducts) ? config.manureProducts : undefined,
      },
      usage: {
        ...usage,
        savingsBalances: usage.savingsBalances ?? 0,
        openPayoutRuns: usage.openPayoutRuns ?? 0,
        outstandingCredit: { advance: 0, loan: 0, manure: 0, ...usage.outstandingCredit },
        teaPacketsOutstanding: usage.teaPacketsOutstanding ?? 0,
        deliveriesByPoint: usage.deliveriesByPoint ?? {},
        suppliersByBank: usage.suppliersByBank ?? {},
        contentByLanguage: usage.contentByLanguage ?? {},
      } as ConfigUsage,
    };
  },

  /**
   * What a patch would cost, without saving it.
   *
   * Pure and local: the console already holds the current config and the usage counts, so
   * asking the server what a change would do would be a round trip for an answer both
   * sides can already compute — and computing it locally is what lets the editor show the
   * consequence *while* the toggle is being considered rather than after it is pressed.
   */
  impactOf: (patch: ConfigPatch, config: RuntimeConfig, usage: ConfigUsage): ConfigImpact[] =>
    configImpact(patch, currentOf(config), usage),

  patch: async (
    patch: ConfigPatch,
    config: RuntimeConfig,
    usage: ConfigUsage,
  ): Promise<AdminConfigResponse> => {
    const impacts = configImpact(patch, currentOf(config), usage);
    if (!isConfigPatchAllowed(impacts)) {
      const blocking = impacts.find((impact) => impact.severity === 'blocks')!;
      /**
       * The blocking impact's own key becomes the error's `details`, so the screen names
       * the field and the figure rather than saying "that is not allowed". A refusal a
       * factory administrator cannot act on is a support call.
       */
      throw new ApiError({
        code: blocking.messageKey.includes('point')
          ? 'point-in-use'
          : blocking.messageKey.includes('fallbackLanguage')
            ? 'fallback-language-required'
            : 'flag-has-records',
        message: 'That change would hide records the factory still has to account for.',
        details: { impacts: impacts.filter((impact) => impact.severity === 'blocks') },
      });
    }

    return adminConfigEndpoints.patch(patch);
  },
};
