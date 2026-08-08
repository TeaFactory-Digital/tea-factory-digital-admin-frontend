/**
 * How fresh the figures replicated from the factory's own system are.
 *
 * **The failure this guards against is a sentence, not a crash.** Every money figure in
 * this console is a copy pulled from the factory's system, and the screens say
 * "read-only" — which a clerk reads as "read-only *and current*". On the day the
 * replication job stops, nothing looks wrong: the bills grid renders, the balances add
 * up, and somebody quotes last Tuesday's figure down the telephone.
 *
 * So the assertions here are about **which state is reported when**, and one of them is
 * about a case that is easy to get backwards.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { FACTORY_SYNC_STALE_HOURS, factorySyncState } from '@tfd/domain';
import { factorySyncRepository } from '@/services/repositories/factorySyncRepository';
import { signInAs, signOut } from './render';

const NOW = '2026-08-08T12:00:00.000Z';
const hoursBefore = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();

describe('factorySyncState', () => {
  it('is fresh inside the threshold and stale beyond it', () => {
    expect(factorySyncState({ lastSucceededAt: hoursBefore(0.5) }, NOW)).toBe('fresh');
    expect(factorySyncState({ lastSucceededAt: hoursBefore(FACTORY_SYNC_STALE_HOURS - 0.5) }, NOW))
      .toBe('fresh');
    expect(factorySyncState({ lastSucceededAt: hoursBefore(FACTORY_SYNC_STALE_HOURS + 0.5) }, NOW))
      .toBe('stale');
  });

  it('separates "never" from "stale", because they need different people', () => {
    /**
     * A console that has never synced is showing nothing but its own fixtures — a
     * deployment that was not finished. Telling the office it is "a bit behind" would be
     * false, and would send them to look at a job that has never run.
     */
    expect(factorySyncState({ lastSucceededAt: null }, NOW)).toBe('never');
  });

  it('treats a clock skew as fresh rather than crying wolf', () => {
    /**
     * The factory's clock ninety seconds ahead of ours produces a negative gap. Reporting
     * that as stale would put a warning over a healthy console, and a banner the office
     * learns to ignore is worse than no banner.
     */
    const ahead = new Date(Date.parse(NOW) + 90_000).toISOString();
    expect(factorySyncState({ lastSucceededAt: ahead }, NOW)).toBe('fresh');
  });

  it('is sized against the agreed hourly pull, not against one missed poll', () => {
    // Three hours ≈ three failed attempts. A threshold that fired on a single slow poll
    // would show a red banner most mornings.
    expect(FACTORY_SYNC_STALE_HOURS).toBeGreaterThanOrEqual(2);
  });
});

describe('the sync status endpoint', () => {
  beforeEach(() => {
    signOut();
  });

  it('reports a healthy sync from the mock, rather than 404ing', async () => {
    await signInAs('clerk@galabodatea.lk');
    const status = await factorySyncRepository.get();

    /**
     * The mock reports healthy because the fixture *is* the data — there is no factory
     * system to be behind. What it must not do is omit the endpoint: a 404 would render
     * the "never synced" banner over every screen in development, and a permanent banner
     * is one nobody reads by the second morning.
     */
    expect(status.lastSucceededAt).toBeTruthy();
    expect(factorySyncState(status, new Date().toISOString())).toBe('fresh');
    // The sentence the office can say to a supplier — "we have everything up to the 7th".
    expect(status.coversUpTo).toBeTruthy();
  });

  it('resolves a failure to "we do not know" rather than throwing', async () => {
    // Signed out: the call is refused. A console that could not tell you how fresh its
    // figures are must still show you the figures.
    const status = await factorySyncRepository.get();

    expect(status.lastSucceededAt).toBeNull();
    // Which renders exactly like "never synced" — both mean the same thing to a reader
    // deciding whether to quote a number, so they are deliberately one state.
    expect(factorySyncState(status, new Date().toISOString())).toBe('never');
  });
});
