/**
 * How this person wants the console to look: light or dark, and how large the text is.
 *
 * **A preference, not configuration.** It sits beside the language choice in
 * `localStorage` for the same reasons, and against the same alternative: M14 would have
 * been the obvious home, but §12.1 makes `flagsAndBranding` writable by the factory admin
 * alone — so a clerk on a bright counter, or a weigher who needs larger type, could not
 * change their own screen. Two people sharing one machine at different hours want
 * different answers, and text size is an accessibility need belonging to the reader.
 *
 * Not on the server either. It has to be readable on the sign-in screen, which is exactly
 * where somebody who cannot read small type is most likely to be stuck, and that screen
 * has no session to read a preference from.
 */

import type { Theme } from '@tfd/brand';

export type ConsoleScheme = 'light' | 'dark';

/**
 * Three steps, not a slider.
 *
 * A slider offers a hundred answers to a question with three useful ones, and every one of
 * them is a layout nobody has looked at. The steps are small on purpose — 1.25 already
 * pushes the widest table header onto two lines, and anything past it is browser zoom's
 * job rather than a type scale's.
 */
export const TEXT_SIZES = ['normal', 'large', 'larger'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

const TEXT_SCALE: Record<TextSize, number> = {
  normal: 1,
  large: 1.125,
  larger: 1.25,
};

export interface Appearance {
  scheme: ConsoleScheme;
  textSize: TextSize;
}

/**
 * Light and normal until somebody says otherwise.
 *
 * Deliberately **not** sniffed from `prefers-color-scheme`, for the same reason the
 * language is not sniffed from `navigator.language`: the console runs on shared office
 * desktops whose OS setting reflects whoever configured the machine, not whoever is
 * standing at it. Flipping a clerk's screen to dark because a technician set the desktop
 * that way is a preference nobody expressed.
 */
export const DEFAULT_APPEARANCE: Appearance = { scheme: 'light', textSize: 'normal' };

const STORAGE_KEY = 'tfd.admin.appearance';

const isScheme = (value: unknown): value is ConsoleScheme =>
  value === 'light' || value === 'dark';

const isTextSize = (value: unknown): value is TextSize =>
  typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value);

/**
 * Reads the stored preference, one field at a time.
 *
 * Guarded and per-field, because Safari in private mode throws on `localStorage` rather
 * than returning null, and because a payload written by an older or newer build must not
 * cost the reader both settings — an unrecognised `textSize` falls back on its own without
 * taking a perfectly good `scheme` with it.
 */
export function readAppearance(): Appearance {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_APPEARANCE;

    const record = parsed as Record<string, unknown>;
    return {
      scheme: isScheme(record.scheme) ? record.scheme : DEFAULT_APPEARANCE.scheme,
      textSize: isTextSize(record.textSize) ? record.textSize : DEFAULT_APPEARANCE.textSize,
    };
  } catch {
    // Unreadable storage, or JSON somebody hand-edited. Neither is worth a broken console.
    return DEFAULT_APPEARANCE;
  }
}

export function persistAppearance(appearance: Appearance): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // A session that cannot persist the choice still honours it until reload.
  }
}

/**
 * Scales the **type scale** and nothing else.
 *
 * Spacing, radii and icons are left alone deliberately. They are `px` in this theme just
 * as the font sizes are, so scaling them together would be no harder — but it would change
 * the console's *density* rather than its legibility, and every grid, sticky table header
 * and fixed-width filter on fourteen screens would need looking at again. Larger text in
 * the same frame is what somebody asking for this actually wants, and it is the thing
 * accessibility guidance asks for.
 *
 * Line height and letter spacing come along because they are `px` too: scaling the glyphs
 * and leaving the leading behind produces overlapping lines at `larger`, which looks like a
 * rendering fault rather than a setting.
 */
export function scaleTypography(theme: Theme, textSize: TextSize): Theme {
  const factor = TEXT_SCALE[textSize];
  if (factor === 1) return theme;

  const variants = Object.fromEntries(
    Object.entries(theme.typography.variants).map(([name, variant]) => [
      name,
      {
        ...variant,
        fontSize: Math.round(variant.fontSize * factor),
        lineHeight: Math.round(variant.lineHeight * factor),
        letterSpacing:
          variant.letterSpacing === undefined
            ? undefined
            : Number((variant.letterSpacing * factor).toFixed(2)),
      },
    ]),
  ) as Theme['typography']['variants'];

  return { ...theme, typography: { ...theme.typography, variants } };
}
