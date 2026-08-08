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
import {
  DEFAULT_SYNC_WINDOW,
  FACTORY_SYNC_STALE_HOURS,
  factorySyncState,
  openMinutesBetween,
} from '@tfd/domain';
import { factorySyncRepository } from '@/services/repositories/factorySyncRepository';
import { signInAs, signOut } from './render';

const NOW = '2026-08-08T12:00:00.000Z'; // 17:30 Colombo — inside the polling window
const hoursBefore = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();

/** Colombo local wall time as an instant. Colombo is UTC+05:30 all year. */
const colombo = (day: string, hh: number, mm = 0) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + (hh * 60 + mm - 330) * 60_000).toISOString();

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

  it('does not call the overnight gap a fault, because nobody was going to poll', () => {
    /**
     * **The reason this file grew a polling window.** Pulling around the clock buys
     * nothing — the factory's data only moves while the factory is open — so the
     * schedule stops at eight in the evening and resumes at half past five.
     *
     * Measured in wall-clock hours, the first clerk in at six every morning would find a
     * red banner over a perfectly healthy console: the last success really is ten hours
     * old. Correct, useless, and read by nobody after the first week.
     */
    const lastNight = colombo('2026-08-07', 20, 0);
    const thisMorning = colombo('2026-08-08', 6, 0);

    const wallClockHours = (Date.parse(thisMorning) - Date.parse(lastNight)) / 3_600_000;
    expect(wallClockHours).toBe(10); // what the old rule saw, and shouted about

    // What the schedule actually skipped: half an hour of polling time.
    expect(openMinutesBetween(lastNight, thisMorning)).toBe(30);
    expect(factorySyncState({ lastSucceededAt: lastNight }, thisMorning)).toBe('fresh');
  });

  it('still reports a genuinely skipped day', () => {
    /**
     * The other half of the bargain. Discounting the night must not discount a failure
     * that happened *during* the day, or the banner never fires at all — which is a
     * worse outcome than firing every morning.
     */
    const twoNightsAgo = colombo('2026-08-06', 20, 0);
    const thisMorning = colombo('2026-08-08', 6, 0);

    // A full working day of polls missed, plus this morning's.
    const { openMinute, closeMinute } = DEFAULT_SYNC_WINDOW;
    expect(openMinutesBetween(twoNightsAgo, thisMorning)).toBe(closeMinute - openMinute + 30);
    expect(factorySyncState({ lastSucceededAt: twoNightsAgo }, thisMorning)).toBe('stale');
  });

  it('counts nothing at all across a night with no polling in it', () => {
    // Eight in the evening to five in the morning: entirely outside the window.
    expect(openMinutesBetween(colombo('2026-08-07', 20, 30), colombo('2026-08-08', 5, 0))).toBe(0);
  });

  it('keeps the numeric third argument working', () => {
    // `factorySyncState(status, now, 6)` predates the options object and still reads
    // clearly at the call site. Silently ignoring it would loosen the banner, not tighten
    // it — the failure would be a banner that never appears.
    expect(factorySyncState({ lastSucceededAt: hoursBefore(4) }, NOW, 6)).toBe('fresh');
    expect(factorySyncState({ lastSucceededAt: hoursBefore(4) }, NOW, 2)).toBe('stale');
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
