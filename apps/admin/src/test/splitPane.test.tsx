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
import {
  GRID_CARD_PANE,
  SPLIT_PANE,
  SPLIT_PANE_BOTH,
  SPLIT_PANE_SCROLLER,
} from '@/components/ui/layout';
import { BannerEditorScreen } from '@/modules/banners/BannerEditorScreen';
import { ConfigurationScreen } from '@/modules/configuration/ConfigurationScreen';
import { NotificationsScreen } from '@/modules/notifications/NotificationsScreen';
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

/**
 * The other shape: **both** sides scroll, the page does not.
 *
 * Same class of silent failure as `SPLIT_PANE`, plus one of its own — the floor. A card
 * that will not shrink below 22 rem inside a container that clips has to overflow
 * something, so leaving `GRID_CARD` on the grid column would leave the page scrolling
 * with no scrollbar to show for it.
 */
describe('SPLIT_PANE_BOTH', () => {
  it('clips the container and drops the floor, above `lg` only', () => {
    // The container hides its own overflow so neither column can push the page.
    expect(SPLIT_PANE_BOTH).toContain('lg:overflow-hidden');
    // And can shrink at all: without this it inherits `min-height: auto` from its children.
    expect(SPLIT_PANE_BOTH).toContain('min-h-0');

    // The floor moves to `max-lg:`, where the columns stack and the page is what scrolls.
    expect(GRID_CARD_PANE).toContain('max-lg:min-h-[22rem]');
    expect(GRID_CARD_PANE).toContain('lg:min-h-0');
  });

  it('never sets the same property twice at one width', () => {
    /**
     * `max-lg:` and `lg:` are mutually exclusive, so neither can be overridden by the
     * order Tailwind happens to emit them in — the trap `GRID_CARD` documents. A bare
     * `min-h-…` alongside either would reintroduce it.
     */
    const heights = GRID_CARD_PANE.split(' ').filter((rule) => rule.includes('min-h-'));
    expect(heights).toEqual(['max-lg:min-h-[22rem]', 'lg:min-h-0']);
  });

  it('leaves the page scrolling below `lg`, where a clipped container strands a column', () => {
    // Stacked, the second column would sit below a fold with no scrollbar anywhere.
    for (const rule of SPLIT_PANE_BOTH.split(' ')) {
      if (rule.includes('overflow')) expect(rule.startsWith('lg:'), rule).toBe(true);
    }
  });
});

describe('M13 notifications', () => {
  it('gives each column its own scrollbar and the page none', async () => {
    await signInAs(ADMIN);
    const { container } = renderWithProviders(<NotificationsScreen />, { route: '/notifications' });

    await screen.findByRole('table', { name: 'Notifications' });

    const pane = paneOf(container);
    expect(pane).toBeTruthy();
    expect(pane).toHaveClass('lg:overflow-hidden');

    const [log, settings] = Array.from(pane!.children);

    // The log shrinks above `lg` rather than forcing the page to scroll; its `DataTable`
    // owns the scrollbar from there.
    expect(log).toHaveClass('lg:min-h-0');
    expect(log).toHaveClass('max-lg:min-h-[22rem]');

    // The settings read down on their own, so reaching a toggle never moves the list.
    expect(settings).toHaveClass('lg:overflow-y-auto');
    expect(settings).toHaveClass('lg:min-h-0');
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
  /**
   * Skipped for a while, because the screen could not load: `GET /admin/banners/{id}` and
   * its preview did not exist (gap **G-08**). Both are served now, so this runs again —
   * and nothing about the assertion needed changing, which was the argument for skipping
   * it rather than deleting it or propping it up with a fixture for a route the server
   * did not have.
   *
   * The layout rule it protects: on a split pane the half that stays put is the half being
   * *consulted*, and a preview that scrolls out of sight while the copy grows is a preview
   * nobody can check against.
   */
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
