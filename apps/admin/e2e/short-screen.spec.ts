import { expect, test, type Page } from '@playwright/test';

/**
 * Every grid screen, on a 13-inch laptop.
 *
 * This exists because a bug got past the rest of the suite. The notifications list
 * collapsed to **zero pixels** at 1440×700 — the rows were still in the DOM at their
 * normal size, clipped by a zero-height scroll container — and the browser test asserting
 * `toBeVisible()` on the first row **passed the whole time**. Playwright's visibility
 * check asks whether an element has a box and is not `visibility: hidden`; it does not ask
 * whether the box is anywhere a person could see it.
 *
 * So the assertion here is the stronger one: the first row must be **inside the viewport**,
 * scrolling the page first if it sits below the fold. Both outcomes are acceptable — a
 * grid that fits, or a page that scrolls to reach it — and the one that is not is a list
 * that exists only in the DOM.
 *
 * 785 is a MacBook Air 13" with browser chrome; 700 and 640 are the same machine scaled up
 * or with a smaller window, which is how people actually run it.
 *
 * **Both a wide and a narrow width are covered, and the narrow one is load-bearing.** The
 * notifications screen puts its settings beside the log above `xl`, which hides the
 * underlying problem at 1440: reverting the fix and running only the wide case passed. At
 * 1152 the columns stack, the settings sit under the log, and the card's floor is the only
 * thing holding the list open. Reverting both halves fails four of these five viewports,
 * which is the check that this suite is worth having.
 *
 * **One sign-in, as the manager.** §12.1 gives them read on all six of these screens, and
 * an earlier version that signed in per screen — six full bootstraps per viewport — was
 * flaky for reasons that had nothing to do with layout.
 */

const MANAGER = 'manager@galabodatea.lk';
const PASSWORD = 'demo1234';
const MFA_CODE = '123456';

/** Every screen whose main artefact is a grid, and the grid's accessible name. */
const SCREENS = [
  { path: '/notifications', label: 'Notifications' },
  { path: '/suppliers', label: 'Suppliers' },
  { path: '/savings', label: 'Savings accounts' },
  { path: '/payouts', label: 'Payouts' },
  { path: '/news', label: 'News' },
  { path: '/inquiries', label: 'Inquiries' },
];

const VIEWPORTS = [
  { width: 1440, height: 785 },
  { width: 1440, height: 700 },
  { width: 1440, height: 640 },
  // Below `xl`, where multi-column screens stack and the grid floor does the work.
  { width: 1152, height: 700 },
  { width: 1152, height: 640 },
];

/** The manager has MFA enrolled, so a password alone is not a session. */
async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(MANAGER);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page.getByRole('heading', { name: /two-factor code/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel(/^code$/i).fill(MFA_CODE);
  await page.getByRole('button', { name: /^verify$/i }).click();

  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 15_000 });
}

for (const { width, height } of VIEWPORTS) {
  test(`every grid keeps usable rows at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page);

    for (const screen of SCREENS) {
      await page.goto(screen.path);

      /**
       * Wait for the route to have rendered before looking for its grid.
       *
       * Every screen puts exactly one `<h1>` in `main` (see `PageHeader`), so this is a
       * route-agnostic "the lazy chunk arrived, the capability gate passed, React has
       * painted" signal.
       *
       * The timeout is deliberately long, and it is a **cold-start** budget rather than a
       * correctness one. This suite walks six lazy routes at five viewports, so the run
       * straight after any edit pays for Vite re-transforming thirty route loads at once —
       * which failed reproducibly at 20 s and passed on every warm run after it. Sizing
       * for the cold case is honest; retrying until it passes would not be.
       */
      await expect(page.locator('main#main h1')).toBeVisible({ timeout: 60_000 });

      const table = page.locator(`table[aria-label="${screen.label}"]`);
      const emptyState = page.getByText(
        /nothing to show|no articles yet|nothing has been sent|the queue is clear|no bills for this month|no payout runs/i,
      );

      /**
       * Wait for the grid **or** its empty state, then only measure when there is a grid.
       *
       * Waiting on the table alone made this flaky: a screen that legitimately has nothing
       * to list renders an `EmptyState` instead, and a 20-second wait for a table that is
       * never coming reads as a layout failure. The distinction matters in the other
       * direction too — a *collapsed* grid still renders its table, which is the bug this
       * suite exists for, so "no table" can only mean empty and never means broken.
       */
      await expect(table.or(emptyState).first()).toBeVisible({ timeout: 20_000 });
      if (!(await table.isVisible())) continue;

      const rows = table.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      const inView = async () => {
        const box = await rows.first().boundingBox();
        return box !== null && box.y >= 0 && box.y + box.height <= height;
      };

      if (!(await inView())) {
        // Below the fold is fine — unreachable is not. Scroll the way a reader would.
        await page.locator('main#main').evaluate((el) => el.scrollTo(0, el.scrollHeight));
        await page.waitForTimeout(200);
      }

      expect(
        await inView(),
        `${screen.path} at ${width}x${height}: the first row is not reachable on screen`,
      ).toBe(true);
    }
  });
}
