/**
 * Whether the console makes its interface sounds (26 November 2026): each person's choice,
 * in this browser, switched on the profile and **off by default**. An office is a shared
 * room, and a sound nobody asked for is a sound somebody has to find the switch for.
 *
 * Separate from the new-request chime (`lib/requestAlerts.ts`), which is a different
 * promise: that one sounds on its own when a supplier writes in, these only ever answer a
 * click or a key the person pressed themselves.
 *
 * ## Rules for callers
 *
 *  - Call `playSound` from a click or key handler, never from an effect, a query result,
 *    polling or a timer. A browser blocks audio before the first gesture anyway, and a
 *    console that beeps by itself is one people mute.
 *  - One sound per action. When an action sets off several things, play the one that says
 *    what happened.
 *  - Nothing on hover, focus or typing.
 */

import { useSyncExternalStore } from 'react';
import { sounds, type SoundId } from './engine';

const KEY = 'tfd.admin.uiSound';

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

/** One shared copy, so the profile switch and every caller agree at once. */
let current: boolean | null = null;
const listeners = new Set<() => void>();

export function getUiSound(): boolean {
  current ??= read();
  return current;
}

export function setUiSound(on: boolean): void {
  current = on;
  try {
    if (on) window.localStorage.setItem(KEY, 'on');
    else window.localStorage.removeItem(KEY);
  } catch {
    // Kept for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUiSound(): boolean {
  return useSyncExternalStore(subscribe, getUiSound, () => false);
}

/** Plays the sound if this person has sounds on; otherwise nothing. */
export function playSound(id: SoundId): void {
  if (getUiSound()) sounds[id]();
}
