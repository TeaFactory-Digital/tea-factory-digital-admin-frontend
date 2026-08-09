/**
 * M1's queue cards must reach the screens they count.
 *
 * The dashboard is the first screen of the day, and each card is a promise: *this many
 * things are waiting, and clicking here is where you deal with them*. A card that cannot
 * resolve its screen falls back to a grey **"No screen for this in this version"** badge
 * — deliberately, because a newer API may name a queue this build has never heard of, and
 * a real backlog is still worth showing even when the link is not.
 *
 * That fallback is honest for an unknown queue and a lie for a known one, which is what
 * made the bug this file exists for so quiet: the advances, loans and manure cards each
 * announced that the console had no screen for them, while M7 sat in the sidebar two
 * inches to the left. Nothing threw, nothing was logged, and the counts were right.
 *
 * The cause was a shape mismatch. `NavItem.queue` is `QueueKey | QueueKey[]` — M7 answers
 * for all three credit facilities behind one link — and the lookup compared
 * `item.queue === queue.queue`. An array is never equal to a string, so the one row that
 * needed the array form was the one row that could not be found.
 *
 * **These assertions render the screen rather than re-deriving the lookup.** A test that
 * recomputed the nav join with `queuesOf` would have agreed with itself and passed
 * against the broken component — which is exactly how the bug survived a suite of four
 * hundred tests. What is checked here is the `href` the office actually clicks.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { within } from '@testing-library/react';
import { NAVIGATION, queuesOf } from '@/layout/navigation';
import { DashboardScreen } from '@/modules/dashboard/DashboardScreen';
import { en } from '@/i18n/locales/en';
import { renderWithProviders, signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';

/**
 * Every href the queue cards offer, once the summary has landed.
 *
 * Scoped to this render's own container rather than asked of the global `screen`. The
 * suite shares one document, so a `getAllByRole('link')` across the whole of it also
 * collects the sidebar and whatever a neighbouring file left mounted — which turns "how
 * many links point at /credit" into a question about test ordering. It passed under the
 * default pool and failed under `--pool=forks --singleFork`, which is the worst way for a
 * test to be wrong: green until the day somebody changes how the suite is run.
 */
async function queueLinks(container: HTMLElement): Promise<string[]> {
  const view = within(container);
  // `findAll`: a linked card prints its label twice — once as the heading, once beside
  // the arrow — so the singular query would fail on the very cards being asserted.
  await view.findAllByText(en['dashboard.queue.changeRequests']);
  return view.getAllByRole('link').map((node) => node.getAttribute('href') ?? '');
}

beforeEach(() => {
  signOut();
});

describe('dashboard queue cards', () => {
  it('links every queue it shows, rather than disowning three of them', async () => {
    await signInAs(CLERK);
    const { container } = renderWithProviders(<DashboardScreen />);

    const hrefs = await queueLinks(container);

    /**
     * The bug in one assertion. All three credit facilities were rendering the grey
     * badge, so this read zero links to `/credit` on a console whose sidebar had the
     * screen the whole time.
     */
    expect(hrefs.filter((href) => href.startsWith('/credit'))).toHaveLength(3);

    // And the badge is absent, which is the half a reader would actually notice.
    expect(within(container).queryByText(en['dashboard.noScreenForQueue'])).not.toBeInTheDocument();
  });

  it('narrows the shared credit screen to the facility that was clicked', async () => {
    await signInAs(CLERK);
    const { container } = renderWithProviders(<DashboardScreen />);

    const hrefs = await queueLinks(container);

    /**
     * M7 holds three queues behind one link, so `?status=pending` alone would open the
     * *Advances* card onto loans and manure too — a card reading four against a screen
     * listing eleven, which reads as a wrong count rather than as a wider filter.
     */
    expect(hrefs).toContain('/credit?status=pending&facility=advance');
    expect(hrefs).toContain('/credit?status=pending&facility=loan');
    expect(hrefs).toContain('/credit?status=pending&facility=manure');

    // A queue that owns its screen outright takes no facility filter.
    expect(hrefs).toContain('/change-requests?status=pending');
  });

  it('gives every queue-bearing nav row a distinct queue', () => {
    /**
     * The lookup takes the *first* row claiming a queue, so a queue claimed twice would
     * send its card to whichever happens to be declared first — a link that changes when
     * somebody reorders the sidebar, and nothing to show for it in review.
     */
    const claimed = NAVIGATION.flatMap((section) => section.items).flatMap(queuesOf);
    expect(claimed).toHaveLength(new Set(claimed).size);
  });
});
