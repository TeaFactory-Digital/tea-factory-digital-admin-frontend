/**
 * The runtime tenant config, and the flags read from it.
 *
 * This is the console's answer to the app's `ClientConfigProvider`. The
 * difference is where the value comes from — the app compiles it in, the console
 * fetches it — and one consequence of that: the fetch can fail, and the console
 * must still work. So the provider never blocks and never errors; it renders with
 * bundled defaults and reports `degraded`.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { FeatureFlagName, RuntimeConfig } from '@tfd/domain';
import { configRepository } from '@/services/repositories/configRepository';
import { bundledConfig } from './defaults';

interface RuntimeConfigValue {
  config: RuntimeConfig;
  /** True while showing bundled defaults because `/config` could not be read. */
  degraded: boolean;
  /** True until the first fetch settles — for a skeleton, never for a blocker. */
  loading: boolean;
}

const RuntimeConfigContext = createContext<RuntimeConfigValue>({
  config: bundledConfig,
  degraded: false,
  loading: true,
});

export function RuntimeConfigProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<RuntimeConfigValue>({
    config: bundledConfig,
    degraded: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void configRepository.get().then(({ config, degraded }) => {
      if (!cancelled) setValue({ config, degraded, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfig(): RuntimeConfigValue {
  return useContext(RuntimeConfigContext);
}

/** The factory's own identity — name, telephone, reg no, support details. */
export function useFactory() {
  return useRuntimeConfig().config.factory;
}

/**
 * Gate a surface on a feature flag. **Never branch on the tenant id.**
 *
 * A flag turns a surface off end to end: the sidebar row disappears and the
 * route is never reached. And because the API refuses the call too (AC-07), a
 * clerk who bookmarked the URL gets `403 feature-disabled` rather than an empty
 * screen that looks like a bug.
 */
export function useFeatureFlag(flag: FeatureFlagName): boolean {
  const { config } = useRuntimeConfig();
  return config.flags[flag];
}

/** The whole flag block, for a nav that decides many rows at once. */
export function useFeatureFlags() {
  return useRuntimeConfig().config.flags;
}

/**
 * Languages editorial content must be authored in — the si/en/ta tabs in M11/M12.
 *
 * Separate from `supportedLanguages` on purpose: the console *chrome* is English
 * (docs/white-label.md → Localization), but a Sinhala supplier reading an
 * English-only FAQ is the app failing, so content is not optional in any of them.
 */
export function useContentLanguages() {
  const { config } = useRuntimeConfig();
  return useMemo(() => config.localization.contentLanguages, [config.localization.contentLanguages]);
}
