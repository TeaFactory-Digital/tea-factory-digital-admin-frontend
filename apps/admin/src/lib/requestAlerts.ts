/**
 * Alerts for new requests (23 November 2026): a soft chime, and a desktop notification while
 * the console is in a background tab, so the person at the counter hears about a request
 * without watching the bell. Each person's choice, in this browser; both off by default.
 */

export interface RequestAlerts {
  sound: boolean;
  desktop: boolean;
}

const KEY = 'tfd.admin.alerts';
export const DEFAULT_ALERTS: RequestAlerts = { sound: false, desktop: false };

export function readAlerts(): RequestAlerts {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_ALERTS;
    const record = parsed as Record<string, unknown>;
    return { sound: record.sound === true, desktop: record.desktop === true };
  } catch {
    return DEFAULT_ALERTS;
  }
}

export function persistAlerts(alerts: RequestAlerts): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(alerts));
  } catch {
    // Kept for this visit only.
  }
}

/** Only what a supplier sends in: these are the ones somebody at the office must act on. */
export const ALERT_KINDS = new Set(['creditRequest.created', 'teaPacket.created', 'changeRequest.created', 'inquiry.created']);

/**
 * Two soft rising notes, made in the browser: no sound file to ship or load, and quiet
 * enough for an office. Silently nothing where audio is unavailable or not yet allowed.
 */
export function playChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const start = context.currentTime;
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const at = start + index * 0.14;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.4);
    });
    window.setTimeout(() => void context.close(), 800);
  } catch {
    // No audio here: the bell still shows it.
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** One shared copy, so the profile switch and the watcher in the shell agree at once. */
let current: RequestAlerts | null = null;
const listeners = new Set<() => void>();

export function getAlerts(): RequestAlerts {
  current ??= readAlerts();
  return current;
}

export function setAlerts(next: RequestAlerts): void {
  current = next;
  persistAlerts(next);
  listeners.forEach((listener) => listener());
}

export function subscribeAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
