import type { FactorySyncStatus } from '@tfd/domain';
import { dashboardEndpoints } from '../endpoints/dashboard';

/**
 * How fresh the figures replicated from the factory's own system are.
 *
 * **It rides on `GET /admin/dashboard`.** There is no `GET /admin/factory-sync`, and the
 * API says so deliberately (ADR-005, Q18) — so this is a resolved decision rather than a
 * gap, and the endpoint module the console used to carry for it is gone.
 *
 * It keeps its own repository and its own query key all the same, for the reason the
 * endpoint was wanted in the first place: **every money screen needs this, not only M1.**
 * A clerk reading a balance to a supplier might be on the bills grid, a supplier's month
 * history or the credit queue, and a freshness signal available only where the dashboard
 * is rendered is available exactly where nobody is standing when they quote a figure.
 * React Query holds one entry under `qk.factorySync`, so the shell asking for it on every
 * screen costs one request, not one per screen.
 *
 * **Never throws.** A console that could not tell you how fresh its figures are must
 * still show you the figures — the alternative is an error page over a working screen
 * because a status call timed out.
 */
export const factorySyncRepository = {
  async get(): Promise<FactorySyncStatus> {
    try {
      const { sync } = await dashboardEndpoints.get();
      /**
       * `null` from the API means **no sync is configured** — a unified deployment where
       * the console reads the factory's records directly and there is nothing to be
       * behind. It resolves to the same all-null status as a failure, which is correct:
       * in both cases there is no freshness to report, and the caption is not rendered.
       */
      return sync ?? EMPTY;
    } catch {
      /**
       * Indistinguishable from never having synced, on purpose. Both mean the office
       * cannot rely on what is on screen, and inventing a third state would ask the
       * reader to tell apart two situations with the same consequence.
       */
      return EMPTY;
    }
  },
};

const EMPTY: FactorySyncStatus = {
  lastSucceededAt: null,
  lastAttemptedAt: null,
  coversUpTo: null,
};
