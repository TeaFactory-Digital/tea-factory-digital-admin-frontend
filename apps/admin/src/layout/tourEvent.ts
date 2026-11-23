/**
 * The welcome tour's switches (24 November 2026): the event that opens it from the user menu
 * or Ctrl+K, and the per-user mark that it has been seen, so it greets each person once.
 */

export const TOUR_EVENT = 'tfd:tour';

/** Opens the welcome tour from anywhere. */
export function openTour(): void {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

const seenKey = (userId: string) => `tfd.admin.tour.seen.${userId}`;

/** Whether this user has closed the tour before. Unreadable storage counts as seen. */
export function tourSeen(userId: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(userId)) === '1';
  } catch {
    // A private window that refuses storage: never greet on every page load.
    return true;
  }
}

export function markTourSeen(userId: string): void {
  try {
    window.localStorage.setItem(seenKey(userId), '1');
  } catch {
    // Nothing to keep it in; the tour simply may show again next time.
  }
}
