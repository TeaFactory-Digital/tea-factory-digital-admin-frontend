/**
 * How fresh the figures replicated from the factory's own system are.
 *
 * Owned by the shell for the same reason the dashboard summary is: **every screen needs
 * it**, and a clerk quoting a balance to a supplier could be standing on any of them.
 * One query, many consumers.
 */

import { useQuery } from '@tanstack/react-query';
import { factorySyncState, type FactorySyncState, type FactorySyncStatus } from '@tfd/domain';
import { UNAVAILABLE, factorySyncRepository } from '@/services/repositories/factorySyncRepository';
import { qk } from '@/query/queryKeys';
import { useCan } from '@/auth/authStore';

/** The domain's three states, plus `unknown`: the status call itself failed. */
export type SyncView = FactorySyncState | 'unknown';

interface FactorySyncView {
  /** `null` when this deployment has no sync at all; `undefined` while loading or unknown. */
  status: FactorySyncStatus | null | undefined;
  state: SyncView;
  /**
   * `false` when the API reports no sync configured. There is then nothing to be behind,
   * so the state reads `fresh` and nothing warns.
   */
  configured: boolean;
}

export function useFactorySync(): FactorySyncView {
  const canReadDashboard = useCan('reports', 'read');
  const { data } = useQuery({
    queryKey: qk.factorySync,
    queryFn: factorySyncRepository.get,
    // Read from `GET /admin/dashboard`, which needs `reports: R`. An editor has none, and
    // this polled every five minutes into a `403` on every screen they opened.
    enabled: canReadDashboard,
    /**
     * Refetched on an interval, unlike anything else in this console.
     *
     * Staleness is a property of *elapsed time* rather than of anything the user did, so
     * a value that only refreshed on navigation would go on claiming "fresh" for as long
     * as somebody stayed on one screen, which is exactly the situation the indicator
     * exists for: a clerk on the bills grid, on the telephone, for twenty minutes.
     */
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    // Never take the console down over a status call. The repository already resolves a
    // failure to "we do not know", which renders as a reason not to quote a figure.
    throwOnError: false,
    retry: false,
  });

  if (data === UNAVAILABLE) return { status: undefined, state: 'unknown', configured: true };

  return {
    status: data,
    /**
     * `undefined` while the first fetch is in flight reads as **fresh**, not as stale.
     *
     * A banner that flashed across the shell on every page load, then disappeared, would
     * be a banner nobody reads by the end of the first morning.
     */
    state: data ? factorySyncState(data, new Date().toISOString()) : 'fresh',
    configured: data !== null,
  };
}
