/**
 * The reader's own scheme and text size.
 *
 * `BrandProvider` carried `const CONSOLE_SCHEME = 'light'` with a note that the dark
 * palette already existed and turning it on would be "a toggle plus a QA pass, not a
 * refactor". This is that toggle, and what makes it worth testing is *where the setting
 * lives*, not that a palette exists.
 *
 * It is a `localStorage` preference rather than an M14 field because §12.1 makes
 * `flagsAndBranding` writable by the factory admin alone. Put in configuration, a clerk on
 * a bright counter and an editor who needs larger type would both be stuck with whatever
 * somebody else chose, and text size is an accessibility need belonging to the reader.
 * That is the decision these guard.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceProvider } from '@/brand/AppearanceProvider';
import { AppearanceControls } from '@/brand/AppearanceControls';
import { BrandProvider } from '@/brand/BrandProvider';
import { Dialog } from '@/components/ui/Dialog';
import { renderWithProviders } from './render';
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
  // `appearance.ts` swallow that, which is the right production behaviour and makes
  // persistence unobservable without a real one.
  installLocalStorage();
});

describe('the appearance preference', () => {
  it('starts light and normal, rather than guessing from the machine', () => {
    /**
     * Deliberately not `prefers-color-scheme`. The console runs on shared office desktops
     * whose OS setting reflects whoever configured the machine, not whoever is standing at
     * it: the same reason the language is not sniffed from `navigator.language`.
     */
    expect(readAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(DEFAULT_APPEARANCE.scheme).toBe('light');
  });

  it('survives a reload', () => {
    persistAppearance({ scheme: 'dark', textSize: 'larger', glass: true, backdrop: 'estate', photo: null });
    expect(readAppearance()).toEqual({ scheme: 'dark', textSize: 'larger', glass: true, backdrop: 'estate', photo: null });
  });

  it('falls back per field, so one bad value does not cost both settings', () => {
    // Written by an older or newer build, or hand-edited. Losing a perfectly good `scheme`
    // because `textSize` is unrecognised would be a preference silently reset.
    window.localStorage.setItem(
      'tfd.admin.appearance',
      JSON.stringify({ scheme: 'dark', textSize: 'enormous' }),
    );

    expect(readAppearance()).toEqual({ scheme: 'dark', textSize: 'normal', glass: false, backdrop: 'colours', photo: null });
  });

  it('reads a preference saved before the glass effect existed as glass off', () => {
    window.localStorage.setItem('tfd.admin.appearance', JSON.stringify({ scheme: 'dark', textSize: 'large' }));
    expect(readAppearance()).toEqual({ scheme: 'dark', textSize: 'large', glass: false, backdrop: 'colours', photo: null });
    expect(DEFAULT_APPEARANCE.glass).toBe(false);
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
     * it would move every grid, sticky header and fixed-width filter on fourteen screens,
     * and larger text in the same frame is what somebody asking for this wants.
     */
    const larger = scaleTypography(base, 'larger');
    expect(larger.spacing).toBe(base.spacing);
    expect(larger.radius).toBe(base.radius);
    expect(larger.iconSizes).toBe(base.iconSizes);
  });
});

describe('the glass effect', () => {
  afterEach(() => {
    delete document.documentElement.dataset.glass;
  });

  it('is turned on and off from the Appearance controls, as an attribute the CSS keys on', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppearanceProvider>
        <BrandProvider>
          <AppearanceControls />
        </BrandProvider>
      </AppearanceProvider>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Glass effect' });
    expect(within(group).getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.glass).toBeUndefined();

    await user.click(within(group).getByRole('radio', { name: 'On' }));
    expect(document.documentElement.dataset.glass).toBe('on');
    // The refraction filter the CSS points at is in the page while the effect is on.
    expect(document.getElementById('tfd-liquid-glass')).not.toBeNull();
    expect(readAppearance().glass).toBe(true);

    await user.click(within(group).getByRole('radio', { name: 'Off' }));
    expect(document.documentElement.dataset.glass).toBeUndefined();
    expect(document.getElementById('tfd-liquid-glass')).toBeNull();
  });

  it('marks dialogs as a glass surface, and nothing in a dialog body', () => {
    renderWithProviders(
      <Dialog open onOpenChange={() => {}} title="Test">
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-glass-surface', 'dialog');
    expect(dialog.querySelectorAll('[data-glass-surface]')).toHaveLength(0);
  });
});

describe('the background behind the glass', () => {
  const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  afterEach(() => {
    delete document.documentElement.dataset.glass;
    delete document.documentElement.dataset.glassPhoto;
    document.documentElement.style.removeProperty('--glass-photo');
  });

  it('keeps the photo under its own key, apart from the other settings', () => {
    persistAppearance({ scheme: 'light', textSize: 'normal', glass: true, backdrop: 'photo', photo: PHOTO });
    expect(window.localStorage.getItem('tfd.admin.glassPhoto')).toBe(PHOTO);
    expect(window.localStorage.getItem('tfd.admin.appearance')).not.toContain('base64');
    expect(readAppearance()).toMatchObject({ backdrop: 'photo', photo: PHOTO });
  });

  it('reads "your photo" with no photo stored as the factory colours', () => {
    window.localStorage.setItem('tfd.admin.appearance', JSON.stringify({ scheme: 'light', textSize: 'normal', glass: true, backdrop: 'photo' }));
    expect(readAppearance()).toMatchObject({ backdrop: 'colours', photo: null });
  });

  it('offers the background only with glass on, and puts the estate photograph behind it', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppearanceProvider>
        <BrandProvider>
          <AppearanceControls />
        </BrandProvider>
      </AppearanceProvider>,
    );
    expect(screen.queryByRole('radiogroup', { name: 'Background' })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Glass effect' })).getByRole('radio', { name: 'On' }));

    const group = screen.getByRole('radiogroup', { name: 'Background' });
    expect(within(group).getByRole('radio', { name: 'Factory colours' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.glassPhoto).toBeUndefined();

    await user.click(within(group).getByRole('radio', { name: 'Tea estate' }));
    expect(document.documentElement.dataset.glassPhoto).toBe('on');
    expect(document.documentElement.style.getPropertyValue('--glass-photo')).toContain('backdrops/tea-estate.jpg');

    // Glass off takes the photo away with it.
    await user.click(within(screen.getByRole('radiogroup', { name: 'Glass effect' })).getByRole('radio', { name: 'Off' }));
    expect(document.documentElement.dataset.glassPhoto).toBeUndefined();
  });

  it('refuses a file that is not a photo, and says so', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(
      <AppearanceProvider>
        <BrandProvider>
          <AppearanceControls />
        </BrandProvider>
      </AppearanceProvider>,
    );
    await user.click(within(screen.getByRole('radiogroup', { name: 'Glass effect' })).getByRole('radio', { name: 'On' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That file is not a photo');
    expect(readAppearance().backdrop).toBe('colours');
  });
});
