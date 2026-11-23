/**
 * How this person wants the console to look: light or dark, and how large the text is.
 *
 * **A preference, not configuration.** It sits beside the language choice in
 * `localStorage` for the same reasons, and against the same alternative: M14 would have
 * been the obvious home, but §12.1 makes `flagsAndBranding` writable by the factory admin
 * alone, so a clerk on a bright counter, or a weigher who needs larger type, could not
 * change their own screen. Two people sharing one machine at different hours want
 * different answers, and text size is an accessibility need belonging to the reader.
 *
 * Not on the server either. It has to be readable on the sign-in screen, which is exactly
 * where somebody who cannot read small type is most likely to be stuck, and that screen
 * has no session to read a preference from.
 */

import type { Theme } from '@tfd/brand';

/** The reader's choice. `auto` (23 November 2026) is light by day and dark from 6 pm to 6 am. */
export type ConsoleScheme = 'light' | 'dark' | 'auto';
/** What is actually drawn. */
export type DrawnScheme = 'light' | 'dark';

/**
 * Auto follows the office's clock, not the machine's dark-mode setting, for the reason the
 * default does not sniff it either (see `DEFAULT_APPEARANCE`): evening at the counter is
 * the same for everyone at that desk.
 */
export function drawnScheme(choice: ConsoleScheme, now: Date = new Date()): DrawnScheme {
  if (choice !== 'auto') return choice;
  const hour = now.getHours();
  return hour >= 18 || hour < 6 ? 'dark' : 'light';
}

/** Comfortable is the console as designed; compact fits more rows on a 1366 × 768 laptop. */
export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

/** High contrast: darker secondary text and borders, for bright counters and tired eyes. */
export const CONTRASTS = ['normal', 'high'] as const;
export type Contrast = (typeof CONTRASTS)[number];

/** The sidebar in full, or as a rail of icons that gives the grids the width. */
export type SidebarMode = 'full' | 'icons';

/**
 * Three steps, not a slider.
 *
 * A slider offers a hundred answers to a question with three useful ones, and every one of
 * them is a layout nobody has looked at. The steps are small on purpose: 1.25 already
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
  /**
   * The glass effect (22 November 2026): the sidebar, the top bar and dialogs drawn as
   * frosted glass over a soft wash of the factory's colours. Off by default, because the blur
   * costs an older office computer real work and because a plain surface is the easiest to
   * read; grids and cards stay solid either way. The operating system's "reduce
   * transparency" turns it off whatever this says (`theme.css`).
   */
  glass: boolean;
  /**
   * What the glass sits on (22 November 2026): the factory's colours, the tea estate
   * photograph that ships with the console, or the reader's own photo. Only shown while
   * `glass` is on.
   */
  backdrop: GlassBackdrop;
  /**
   * The reader's own photo, as a JPEG data URL already scaled down (`backdropPhoto.ts`).
   * Stored under its own key, so a full storage quota costs the photo and never the other
   * settings, and it never leaves this browser.
   */
  photo: string | null;
  density: Density;
  contrast: Contrast;
  sidebar: SidebarMode;
}

export const GLASS_BACKDROPS = ['colours', 'estate', 'photo'] as const;
export type GlassBackdrop = (typeof GLASS_BACKDROPS)[number];

/**
 * Light and normal until somebody says otherwise.
 *
 * Deliberately **not** sniffed from `prefers-color-scheme`, for the same reason the
 * language is not sniffed from `navigator.language`: the console runs on shared office
 * desktops whose OS setting reflects whoever configured the machine, not whoever is
 * standing at it. Flipping a clerk's screen to dark because a technician set the desktop
 * that way is a preference nobody expressed.
 */
export const DEFAULT_APPEARANCE: Appearance = {
  scheme: 'light',
  textSize: 'normal',
  glass: false,
  backdrop: 'colours',
  photo: null,
  density: 'comfortable',
  contrast: 'normal',
  sidebar: 'full',
};

const STORAGE_KEY = 'tfd.admin.appearance';
const PHOTO_KEY = 'tfd.admin.glassPhoto';

const isBackdrop = (value: unknown): value is GlassBackdrop =>
  typeof value === 'string' && (GLASS_BACKDROPS as readonly string[]).includes(value);

const isScheme = (value: unknown): value is ConsoleScheme =>
  value === 'light' || value === 'dark' || value === 'auto';

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (values as readonly string[]).includes(value);
const isDensity = oneOf(DENSITIES);
const isContrast = oneOf(CONTRASTS);
const isSidebar = oneOf<SidebarMode>(['full', 'icons']);

const isTextSize = (value: unknown): value is TextSize =>
  typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value);

/**
 * Reads the stored preference, one field at a time.
 *
 * Guarded and per-field, because Safari in private mode throws on `localStorage` rather
 * than returning null, and because a payload written by an older or newer build must not
 * cost the reader both settings: an unrecognised `textSize` falls back on its own without
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
      glass: typeof record.glass === 'boolean' ? record.glass : DEFAULT_APPEARANCE.glass,
      ...readBackdrop(record.backdrop),
      density: isDensity(record.density) ? record.density : DEFAULT_APPEARANCE.density,
      contrast: isContrast(record.contrast) ? record.contrast : DEFAULT_APPEARANCE.contrast,
      sidebar: isSidebar(record.sidebar) ? record.sidebar : DEFAULT_APPEARANCE.sidebar,
    };
  } catch {
    // Unreadable storage, or JSON somebody hand-edited. Neither is worth a broken console.
    return DEFAULT_APPEARANCE;
  }
}

/** The backdrop, and the photo it needs: "your photo" with no photo stored is the colours. */
function readBackdrop(stored: unknown): Pick<Appearance, 'backdrop' | 'photo'> {
  const backdrop = isBackdrop(stored) ? stored : DEFAULT_APPEARANCE.backdrop;
  let photo: string | null = null;
  try {
    const raw = window.localStorage.getItem(PHOTO_KEY);
    photo = raw && raw.startsWith('data:image/') ? raw : null;
  } catch {
    photo = null;
  }
  if (backdrop === 'photo' && !photo) return { backdrop: 'colours', photo: null };
  return { backdrop, photo };
}

export function persistAppearance(appearance: Appearance): void {
  const { photo, ...settings } = appearance;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // A session that cannot persist the choice still honours it until reload.
  }
  try {
    if (photo) window.localStorage.setItem(PHOTO_KEY, photo);
    else window.localStorage.removeItem(PHOTO_KEY);
  } catch {
    // Too large for what is left of the quota: the photo shows until reload, nothing else lost.
  }
}

/**
 * Scales the **type scale** and nothing else.
 *
 * Spacing, radii and icons are left alone deliberately. They are `px` in this theme just
 * as the font sizes are, so scaling them together would be no harder, but it would change
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
