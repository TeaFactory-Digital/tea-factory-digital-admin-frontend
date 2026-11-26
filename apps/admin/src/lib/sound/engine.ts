/**
 * The console's interface sounds (26 November 2026): short blips made in the browser with
 * Web Audio, so there is no sound file to ship, load or cache.
 *
 * All of them are tuned to C major, so two sounds heard close together never clash, and
 * all but `sent` are under a fifth of a second. `sent` is the one warm chord, because a
 * reply leaving the office is the one act worth hearing land.
 *
 * Nothing here checks whether sounds are on: that is `playSound` in `uiSound.ts`, the only
 * caller a screen should use. The engine is called directly only by the profile's "Try it".
 */

interface Note {
  /** Pitch in hertz. */
  f: number;
  /** Seconds after the sound starts. */
  at?: number;
  /** Seconds until it has faded out. */
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

/** Quiet, because an office hears these all day. */
const MASTER_GAIN = 0.18;

let context: AudioContext | null = null;
let master: GainNode | null = null;

/** One context for the whole visit, made on the first sound: a browser caps how many exist. */
function audio(): { context: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!context || !master) {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);
  }
  // Suspended until the page has had a click; every caller is a click, so this resumes it.
  if (context.state === 'suspended') void context.resume();
  return { context, master };
}

function play(notes: Note[]): void {
  try {
    const out = audio();
    if (!out) return;
    const start = out.context.currentTime + 0.005;
    for (const note of notes) {
      const at = start + (note.at ?? 0);
      const oscillator = out.context.createOscillator();
      const gain = out.context.createGain();
      oscillator.type = note.type ?? 'sine';
      oscillator.frequency.setValueAtTime(note.f, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(note.gain ?? 1, at + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.dur);
      oscillator.connect(gain).connect(out.master);
      oscillator.start(at);
      oscillator.stop(at + note.dur + 0.02);
    }
  } catch {
    // No audio on this machine: the screen still shows what happened.
  }
}

export const sounds = {
  /** Moving to another screen. */
  tick: () => play([{ f: 2093, dur: 0.03 }]),
  /** Opening one item from a list. */
  select: () =>
    play([
      { f: 1568, dur: 0.03 },
      { f: 1047, at: 0.025, dur: 0.035 },
    ]),
  /** A ready-made sentence dropped into the box. */
  insert: () =>
    play([
      { f: 2093, dur: 0.03 },
      { f: 1047, at: 0.03, dur: 0.045 },
    ]),
  /** The main action on a row. */
  pop: () =>
    play([
      { f: 784, dur: 0.09, type: 'triangle' },
      { f: 256, dur: 0.07, gain: 0.4 },
    ]),
  /** A reply or message sent. */
  sent: () =>
    play([
      { f: 80, dur: 0.06, gain: 0.5 },
      { f: 261.6, dur: 0.38 },
      { f: 329.6, at: 0.015, dur: 0.36, gain: 0.8 },
      { f: 392, at: 0.03, dur: 0.34, gain: 0.7 },
      { f: 523.3, at: 0.045, dur: 0.32, gain: 0.6 },
    ]),
  /** A choice of one from a few. */
  toggle: () =>
    play([
      { f: 1568, dur: 0.04, type: 'triangle' },
      { f: 932, at: 0.05, dur: 0.04, type: 'triangle', gain: 0.7 },
      { f: 1661, at: 0.11, dur: 0.05, type: 'triangle', gain: 0.8 },
    ]),
  /** A confirmation opening. */
  open: () => play([{ f: 784, dur: 0.05 }]),
  /** A confirmation accepted. */
  confirm: () =>
    play([
      { f: 2093, dur: 0.03 },
      { f: 261.6, at: 0.25, dur: 0.09, gain: 0.5 },
    ]),
} as const;

export type SoundId = keyof typeof sounds;
