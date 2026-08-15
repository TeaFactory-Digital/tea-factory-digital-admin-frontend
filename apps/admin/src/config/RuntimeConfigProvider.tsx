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
  useState,
  type PropsWithChildren,
} from 'react';
import type { RuntimeConfig } from '@tfd/domain';
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

/** The whole flag block, for a nav that decides many rows at once. */
export function useFeatureFlags() {
  return useRuntimeConfig().config.flags;
}

