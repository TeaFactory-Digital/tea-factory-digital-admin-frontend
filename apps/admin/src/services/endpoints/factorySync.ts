import type { FactorySyncStatus } from '@tfd/domain';
import { apiClient } from '../api/client';

/**
 * How fresh the figures replicated from the factory's own system are.
 *
 * **Its own endpoint rather than a field on the dashboard**, and that is deliberate:
 * every money screen needs it, not only M1. A clerk reading a balance to a supplier
 * might be on the bills grid, a supplier's month history or the credit queue, and a
 * freshness signal that lived on the dashboard payload would be available exactly where
 * nobody is standing when they quote a figure.
 *
 * Unauthenticated is **not** appropriate here — it says what the platform holds and how
 * far behind it is, which is operational detail. Behind the same session as everything
 * else.
 */
export const factorySyncEndpoints = {
  get: () =>
    apiClient.get<FactorySyncStatus>('/admin/factory-sync').then((response) => response.data),
};
