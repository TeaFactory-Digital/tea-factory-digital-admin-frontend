/**
 * The two-column screens whose right side owns the scrollbar.
 *
 * M14 and M12 both put a rail of things to pick from beside the one that is open, and both
 * were built as a plain grid — so the page scrolled as one. The editor on either is several
 * windows tall, which meant choosing a different page or section required scrolling back up
 * to a rail that had left the window. On the screen where picking is half the job, the
 * picker was the part that scrolled away.
 *
 * **This is the class of bug that cannot be caught by looking at it.** jsdom computes no
 * layout, so nothing here proves a scrollbar appears; what it proves is that the three
 * classes that *make* one appear are all present and on the right elements. Any one of them
 * missing is silent — `overflow-y-auto` on a box that never shrinks below its content shows
 * no scrollbar and throws nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { SPLIT_PANE, SPLIT_PANE_SCROLLER } from '@/components/ui/layout';
import { BannerEditorScreen } from '@/modules/banners/BannerEditorScreen';
import { ConfigurationScreen } from '@/modules/configuration/ConfigurationScreen';
import { StaticContentScreen } from '@/modules/static-content/StaticContentScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';

/** The rail's card is the grid's first child; the scroller is its second. */
const paneOf = (container: HTMLElement) => container.querySelector('.grid.gap-lg');

beforeEach(() => {
  signOut();
});

describe('SPLIT_PANE', () => {
  it('carries all three rules, because any one missing is silent', () => {
    // A definite height to resolve against, a floor so a short window cannot collapse it
    // to nothing, and the two-column track.
    expect(SPLIT_PANE).toContain('lg:flex-1');
    expect(SPLIT_PANE).toContain('lg:min-h-[30rem]');

    /**
     * No track. Four screens use this and they do not agree on the proportions — a 1fr/3fr
     * rail and a 3fr/2fr form-and-preview are different judgements about what the reader is
     * looking at, so each states its own.
     */
    expect(SPLIT_PANE).not.toContain('grid-cols-');

    // `min-h-0` is what lets the column shrink below its content. Without it the pane
    // grows to fit the editor and the page scrolls exactly as before.
    expect(SPLIT_PANE_SCROLLER).toContain('lg:min-h-0');
    expect(SPLIT_PANE_SCROLLER).toContain('lg:overflow-y-auto');
  });

  it('stays off below `lg`, where two nested scrollbars are worse', () => {
    // A wheel that stops working depending on where the pointer is.
    for (const rule of `${SPLIT_PANE} ${SPLIT_PANE_SCROLLER}`.split(' ')) {
      if (rule.startsWith('grid') || rule.startsWith('gap-') || rule === '') continue;
      expect(rule.startsWith('lg:'), rule).toBe(true);
    }
  });
});

describe('M12 static content', () => {
  it('scrolls its editor rather than the page, keeping the rail in view', async () => {
    await signInAs(ADMIN);
    const { container } = renderWithProviders(<StaticContentScreen />, { route: '/content' });

    await screen.findByText('Terms of supply');

    const pane = paneOf(container);
    expect(pane).toBeTruthy();
    expect(pane).toHaveClass('lg:flex-1');

    const [rail, scroller] = Array.from(pane!.children);

    /**
     * The rail must NOT clip. A rail that scrolls internally is a page an editor cannot
     * reach, with no scrollbar to look for — worse than the bug being fixed.
     */
    expect(rail).not.toHaveClass('lg:overflow-y-auto');
    expect(scroller).toHaveClass('lg:overflow-y-auto');
    expect(scroller).toHaveClass('lg:min-h-0');
  });
});

describe('M14 configuration', () => {
  it('uses the same pane, so the two cannot drift', async () => {
    await signInAs(ADMIN);
    const { container } = renderWithProviders(<ConfigurationScreen />, { route: '/configuration' });

    await screen.findByDisplayValue('Galaboda Tea Factory');

    const pane = paneOf(container);
    expect(pane).toHaveClass('lg:flex-1');
    // Its scroller is one level in — the editor card owns `overflow-hidden` so the section
    // header stays put while the body moves.
    expect(container.querySelector('.lg\\:overflow-y-auto')).toBeTruthy();
  });
});

/**
 * The same pane, the other way round.
 *
 * On M11 and M8 the fixed half is the **preview**, not the rail — because the half that
 * stays put is the half being *consulted*. Editing banner copy beside a live rendering is
 * checking one against the other, and that cannot be done once the rendering has scrolled
 * out of sight, which is exactly what happens as the copy grows long enough to need it.
 */
describe('M11 banner editor', () => {
  it('scrolls the form and pins the preview', async () => {
    await signInAs(ADMIN);
    // Wrapped in a `Route`, because the screen reads `:id` from the path — rendered bare
    // it looks up a banner with no id and never leaves its loading state.
    const { container } = renderWithProviders(
      <Routes>
        <Route path="/banners/:id" element={<BannerEditorScreen />} />
      </Routes>,
      { route: '/banners/ban-1' },
    );

    await screen.findByText('What the supplier sees');

    const pane = paneOf(container);
    expect(pane).toHaveClass('lg:flex-1');

    const [form, preview] = Array.from(pane!.children);
    expect(form).toHaveClass('lg:overflow-y-auto');
    // A preview that clips is a preview that lies about what the supplier will see.
    expect(preview).not.toHaveClass('lg:overflow-y-auto');
  });
});
