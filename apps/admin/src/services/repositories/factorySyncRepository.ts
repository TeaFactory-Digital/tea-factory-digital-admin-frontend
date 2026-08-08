import type { FactorySyncStatus } from '@tfd/domain';
import { factorySyncEndpoints } from '../endpoints/factorySync';

/**
 * The replication's own state.
 *
 * **Never throws.** A console that could not tell you how fresh its figures are must
 * still show you the figures — the alternative is an error page over a working screen
 * because a status call timed out. A failure resolves to "we do not know", which the UI
 * renders the same way it renders "never synced": as a reason not to quote a number.
 */
export const factorySyncRepository = {
  async get(): Promise<FactorySyncStatus> {
    try {
      return await factorySyncEndpoints.get();
    } catch {
      /**
       * Indistinguishable from never having synced, on purpose. Both mean the office
       * cannot rely on what is on screen, and inventing a third state would ask the
       * reader to tell apart two situations with the same consequence.
       */
      return { lastSucceededAt: null, lastAttemptedAt: null, coversUpTo: null };
    }
  },
};
