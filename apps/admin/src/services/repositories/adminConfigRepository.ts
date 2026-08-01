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
  get: (): Promise<AdminConfigResponse> => adminConfigEndpoints.get(),

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
