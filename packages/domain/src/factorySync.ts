/**
 * How fresh the figures replicated from the factory's own system are.
 *
 * **This exists because of one sentence in `docs/v2/platform-team.md` §3:** accounts and
 * balances in this console are *as fresh as the last successful sync*. A clerk reading a
 * balance to a supplier over the telephone has no way to know that — the screen says
 * "read-only" and implies "and current".
 *
 * The day it matters is the day somebody quotes a figure that changed four hours ago,
 * and there is no way to discover afterwards that they did.
 *
 * ## Why this is not "just show a timestamp"
 *
 * A timestamp in the corner is read by nobody. What the office needs is the **judgement**
 * — *is this current enough to quote?* — which is why `factorySyncState` returns a state
 * rather than an age, and why a stale sync raises a notice across the whole shell rather
 * than a caption on one screen. The figure is quoted from whichever screen happens to be
 * open.
 */

/**
 * How long a gap has to be before the office should be told, in hours.
 *
 * Sized against the agreed pull cadence — hourly — so this is roughly *three attempts
 * have failed*, not *one was slow*. A threshold that fired on a single missed poll would
 * put a red banner over a working console most mornings, and a banner the office learns
 * to ignore is worse than no banner.
 *
 * **Measured in polling hours, not wall-clock hours** — see {@link openMinutesBetween}.
 *
 * A default rather than a policy: once the factory's own operations team has a number,
 * it belongs in `client_config` beside `QUEUE_SLA_HOURS` — and the console must then
 * display the served figure rather than this one.
 */
export const FACTORY_SYNC_STALE_HOURS = 3;

/**
 * The hours of the day the platform actually polls the factory's system.
 *
 * **Polling around the clock buys nothing.** The Factory System's own data only moves
 * while the factory is open: leaf is weighed at the collection points during the day,
 * and requests are raised at the counter. Between eight at night and half past five in
 * the morning every poll returns an empty payload, so two thirds of the calls exist only
 * to be answered "nothing".
 *
 * Colombo local, minutes after midnight. The window opens before the first weighing
 * session so the office finds the overnight catch-up already done.
 */
export interface SyncWindow {
  openMinute: number;
  closeMinute: number;
}

/** 05:30 – 20:00 Colombo: open before the morning session, closed after the evening one. */
export const DEFAULT_SYNC_WINDOW: SyncWindow = { openMinute: 5 * 60 + 30, closeMinute: 20 * 60 };

/** Colombo is UTC+05:30 the year round — no daylight saving, so this is a constant. */
const COLOMBO_OFFSET_MINUTES = 330;

/** Minutes since the Colombo-local epoch, so that `% 1440` is the local minute of day. */
function colomboMinutes(iso: string): number {
  return Math.floor(Date.parse(iso) / 60_000) + COLOMBO_OFFSET_MINUTES;
}

/** Beyond this, the answer is "stale" whatever the arithmetic says — don't loop over years. */
const MAX_DAYS_WALKED = 90;

/**
 * Elapsed **polling time** between two instants — wall-clock hours minus the hours the
 * platform was never going to call anyway.
 *
 * This is the whole reason the freshness banner is trustworthy once polling follows the
 * office's hours. Measured in wall-clock, a sync that succeeded at eight last night is
 * ten hours old when the first clerk signs in at half past six — and a console that
 * showed a red "figures may be out of date" banner every single morning, correctly,
 * would be one the office stopped reading by the end of the first week.
 *
 * Counted this way that same gap is thirty minutes of polling time, because nine and a
 * half of those hours were night. A genuine failure still shows: skip a Sunday's polls
 * and Monday morning is stale, as it should be.
 */
export function openMinutesBetween(
  fromIso: string,
  toIso: string,
  window: SyncWindow = DEFAULT_SYNC_WINDOW,
): number {
  const from = colomboMinutes(fromIso);
  const to = colomboMinutes(toIso);
  // Includes the clock-skew case — the factory's clock ahead of ours is not elapsed time.
  if (to <= from) return 0;

  const { openMinute, closeMinute } = window;
  // A degenerate or round-the-clock window means every hour counts; don't special-case it.
  if (closeMinute <= openMinute) return to - from;
  if (to - from > MAX_DAYS_WALKED * 1440) return to - from;

  let open = 0;
  for (let day = Math.floor(from / 1440); day <= Math.floor((to - 1) / 1440); day += 1) {
    const lo = Math.max(from, day * 1440 + openMinute);
    const hi = Math.min(to, day * 1440 + closeMinute);
    if (hi > lo) open += hi - lo;
  }
  return open;
}

/** Tuning for {@link factorySyncState}, both parts served from config in production. */
export interface FactorySyncOptions {
  staleAfterHours?: number;
  window?: SyncWindow;
}

/**
 * Three states, because "not fresh" hides two very different situations.
 *
 * `never` is not a worse `stale` — it is a **deployment** problem rather than an
 * operational one. A console that has never synced is showing nothing but its own
 * fixtures, and telling the office it is "a bit behind" would be false.
 */
export type FactorySyncState = 'fresh' | 'stale' | 'never';

/** What the platform knows about its own replication from the factory's system. */
export interface FactorySyncStatus {
  /** When a pull last completed. `null` if one never has. */
  lastSucceededAt: string | null;
  /**
   * When one was last **tried**, successful or not.
   *
   * Separate from the above, and the gap between them is the diagnosis: equal means the
   * sync is simply not running, far apart means it is running and failing. One field
   * could not tell those apart, and they need different people.
   */
  lastAttemptedAt: string | null;
  /**
   * The last factory-local date the platform holds data for.
   *
   * What the office actually needs in a sentence — *"we have everything up to the 7th"*
   * is answerable to a supplier, where *"synced 4 hours ago"* is not.
   */
  coversUpTo: string | null;
}

/**
 * Clock-free by design: `now` is passed in.
 *
 * Same rule as `bill.ts` and `leafCredit.ts` — a function that read `Date.now()` could
 * not be tested against a fixed fixture, and this one decides whether a banner appears
 * over every screen in the console.
 */
export function factorySyncState(
  status: Pick<FactorySyncStatus, 'lastSucceededAt'>,
  nowIso: string,
  options: FactorySyncOptions | number = {},
): FactorySyncState {
  if (!status.lastSucceededAt) return 'never';

  const opts = typeof options === 'number' ? { staleAfterHours: options } : options;
  const { staleAfterHours = FACTORY_SYNC_STALE_HOURS, window = DEFAULT_SYNC_WINDOW } = opts;

  /**
   * Polling hours rather than wall-clock hours, so the overnight gap the schedule
   * *intends* is not reported as a fault. A negative gap — the factory's clock ahead of
   * ours — falls out of this as zero: skewed clocks are normal between two systems, and
   * a console that cried "stale" because the other end was ninety seconds fast would be
   * crying wolf.
   */
  const openHours = openMinutesBetween(status.lastSucceededAt, nowIso, window) / 60;
  return openHours > staleAfterHours ? 'stale' : 'fresh';
}
