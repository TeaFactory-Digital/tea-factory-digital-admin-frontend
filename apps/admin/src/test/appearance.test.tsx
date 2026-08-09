/**
 * The reader's own scheme and text size.
 *
 * `BrandProvider` carried `const CONSOLE_SCHEME = 'light'` with a note that the dark
 * palette already existed and turning it on would be "a toggle plus a QA pass, not a
 * refactor". This is that toggle — and what makes it worth testing is *where the setting
 * lives*, not that a palette exists.
 *
 * It is a `localStorage` preference rather than an M14 field because §12.1 makes
 * `flagsAndBranding` writable by the factory admin alone. Put in configuration, a clerk on
 * a bright counter and an editor who needs larger type would both be stuck with whatever
 * somebody else chose — and text size is an accessibility need belonging to the reader.
 * That is the decision these guard.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createTheme } from '@tfd/brand';
import {
  DEFAULT_APPEARANCE,
  persistAppearance,
  readAppearance,
  scaleTypography,
} from '@/brand/appearance';
import { installLocalStorage } from './localStorage';

beforeEach(() => {
  // See `localStorage.ts`: this environment's is an empty object, and the guards in
  // `appearance.ts` swallow that — which is the right production behaviour and makes
  // persistence unobservable without a real one.
  installLocalStorage();
});

describe('the appearance preference', () => {
  it('starts light and normal, rather than guessing from the machine', () => {
    /**
     * Deliberately not `prefers-color-scheme`. The console runs on shared office desktops
     * whose OS setting reflects whoever configured the machine, not whoever is standing at
     * it — the same reason the language is not sniffed from `navigator.language`.
     */
    expect(readAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(DEFAULT_APPEARANCE.scheme).toBe('light');
  });

  it('survives a reload', () => {
    persistAppearance({ scheme: 'dark', textSize: 'larger' });
    expect(readAppearance()).toEqual({ scheme: 'dark', textSize: 'larger' });
  });

  it('falls back per field, so one bad value does not cost both settings', () => {
    // Written by an older or newer build, or hand-edited. Losing a perfectly good `scheme`
    // because `textSize` is unrecognised would be a preference silently reset.
    window.localStorage.setItem(
      'tfd.admin.appearance',
      JSON.stringify({ scheme: 'dark', textSize: 'enormous' }),
    );

    expect(readAppearance()).toEqual({ scheme: 'dark', textSize: 'normal' });
  });

  it('reads unparseable storage as the default instead of throwing', () => {
    // Safari in private mode throws on `localStorage` outright; this is the milder case.
    // A console that refused to boot over a colour preference would be a poor trade.
    window.localStorage.setItem('tfd.admin.appearance', 'not json');
    expect(readAppearance()).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('scaleTypography', () => {
  const base = createTheme('light');

  it('leaves the theme untouched at normal', () => {
    // Identity, not a copy: nothing should re-render because somebody chose the default.
    expect(scaleTypography(base, 'normal')).toBe(base);
  });

  it('scales every variant, so nothing is left behind at the old size', () => {
    const larger = scaleTypography(base, 'larger');

    for (const name of Object.keys(base.typography.variants)) {
      const before = base.typography.variants[name as keyof typeof base.typography.variants];
      const after = larger.typography.variants[name as keyof typeof larger.typography.variants];
      expect(after.fontSize, name).toBeGreaterThan(before.fontSize);
    }
  });

  it('scales line height with the glyphs', () => {
    /**
     * The failure this prevents is visible and looks like a rendering fault rather than a
     * setting: line heights are `px` in this theme, so glyphs that grew inside leading that
     * did not would overlap by `larger`.
     */
    const larger = scaleTypography(base, 'larger');
    const beforeBody = base.typography.variants.body;
    const afterBody = larger.typography.variants.body;

    expect(afterBody.lineHeight / afterBody.fontSize).toBeCloseTo(
      beforeBody.lineHeight / beforeBody.fontSize,
      1,
    );
  });

  it('leaves spacing, radii and icons alone', () => {
    /**
     * Legibility, not density. These are `px` too and scaling them would be no harder, but
     * it would move every grid, sticky header and fixed-width filter on fourteen screens —
     * and larger text in the same frame is what somebody asking for this wants.
     */
    const larger = scaleTypography(base, 'larger');
    expect(larger.spacing).toBe(base.spacing);
    expect(larger.radius).toBe(base.radius);
    expect(larger.iconSizes).toBe(base.iconSizes);
  });
});
