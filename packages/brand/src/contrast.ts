/**
 * Readable whatever the factory's colours: WCAG AA contrast, kept by the theme itself.
 *
 * A white-label console takes its `primary` from the factory. A good brand colour is not
 * necessarily a readable one: galaboda's sea green (#2E8B57) gives 4.24:1 with white,
 * under the 4.5:1 AA asks for normal text, and it is used both as a button fill under white
 * text and as link text on white. The axe audit found it on every screen.
 *
 * So the theme moves a colour **only as far as it must**, along its own hue: darker in the
 * light scheme, lighter in the dark one, in small steps, until every pairing it is drawn in
 * reaches 4.5:1. The office's colour stays recognisably theirs; a colour that already passes
 * is not touched. Only hex values are adjusted; anything else is left as it came.
 */

import type { ColorSchemeName, ColorTokens } from './colors';

/** AA for normal-size text. */
export const AA_TEXT = 4.5;

type Rgb = [number, number, number];

export function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '');
  const full =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.length === 6 || hex.length === 8
        ? hex.slice(0, 6)
        : null;
  if (!full || !/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio of two hex colours, or `null` when either is not hex. */
export function contrastRatio(a: string, b: string): number | null {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return null;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `color`, mixed towards black (`darker`) or white in 2% steps until it reaches `ratio`
 * against every one of `against`. Unchanged when it already does, or is not hex.
 */
export function adjustForContrast(
  color: string,
  against: readonly string[],
  direction: 'darker' | 'lighter',
  ratio = AA_TEXT,
): string {
  const start = parseHex(color);
  if (!start) return color;
  const passes = (candidate: string) =>
    against.every((other) => {
      const r = contrastRatio(candidate, other);
      return r === null || r >= ratio;
    });
  if (passes(color)) return color;
  const target = direction === 'darker' ? 0 : 255;
  for (let step = 1; step <= 50; step += 1) {
    const mix = step * 0.02;
    const candidate = toHex(start.map((c) => c + (target - c) * mix) as Rgb);
    if (passes(candidate)) return candidate;
  }
  return toHex(start.map(() => target) as Rgb);
}

/**
 * The palette with every text pairing at AA, keeping the brand colour as close as it can.
 *
 *  - `primary` is a fill under `primaryContrast` and a text colour on `surface` and
 *    `background`: moved first, only as far as those need.
 *  - `primaryMuted` (a selected row, a chip, a chosen option) carries `primary` and
 *    `textSecondary` text: the **tint** moves, the other way, rather than the brand colour
 *    moving further. A tint is decoration and has no contrast of its own to keep.
 *  - `textSecondary` is read on `surface`, `background`, `surfaceVariant` and the tint.
 */
export function readablePalette(colors: ColorTokens, scheme: ColorSchemeName): ColorTokens {
  const toward = scheme === 'dark' ? 'lighter' : 'darker';
  const away = scheme === 'dark' ? 'darker' : 'lighter';
  const primary = adjustForContrast(colors.primary, [colors.primaryContrast, colors.surface, colors.background], toward);
  const textSecondary = adjustForContrast(
    colors.textSecondary,
    [colors.surface, colors.background, colors.surfaceVariant],
    toward,
  );
  const primaryMuted = adjustForContrast(colors.primaryMuted, [primary, textSecondary, colors.textPrimary], away);
  return { ...colors, primary, primaryMuted, textSecondary };
}
