import { expect, test, type Page } from '@playwright/test';

/**
 * The notification path in a browser.
 *
 * The unit suite proves the refusals and the automatic firing. What only a browser can
 * confirm is the thing the screen exists for: that **the reach figures appear before the
 * send button is usable**, and that a send nobody would receive is visibly refused rather
 * than quietly succeeding.
 *
 * Signed in as the factory administrator, because §12.1 gives `content: A` to them and
 * that is the console's answer to §21.24's second half — who may send free text.
 */

const ADMIN = 'factoryadmin@galabodatea.lk';
const PASSWORD = 'demo1234';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(ADMIN);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 15_000 });
}

test('shows what fires automatically, and what fired', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: /^notifications$/i }).click();
  await expect(page.getByRole('heading', { name: /^notifications$/i })).toBeVisible({
    timeout: 15_000,
  });

  // Each trigger names the event it fires from — a toggle whose trigger is unnamed is a
  // setting nobody can reason about.
  await expect(page.getByText(/fires when a month is published/i)).toBeVisible();

  // §21.24 stated where the decision is made.
  await expect(page.getByText(/still an open question with the factory/i)).toBeVisible();

  // The log carries reach and opt-outs side by side.
  const log = page.getByRole('table', { name: /^notifications$/i });
  await expect(log.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
  await expect(log.getByText(/opted out/i).first()).toBeVisible();
});

test('works out who a message reaches before it can be sent', async ({ page }) => {
  await signIn(page);
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: /^notifications$/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('button', { name: /write a notification/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Nothing to send yet — the category is a required choice, not a default, because the
  // app routes on it.
  await expect(dialog.getByRole('button', { name: /^send/i })).toBeDisabled();

  await dialog.getByLabel(/^kind$/i).selectOption('newsArticle');

  /**
   * The reach panel — the whole reason this is a dialog and not a form.
   *
   * `newsArticle` is not in `defaultCategories`, so most phones have it switched off and
   * the office should see that *before* deciding a push is how to announce something.
   */
  await expect(dialog.getByText(/reaches \d+ phones/i)).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText(/switched off and will not get this/i)).toBeVisible();

  await dialog.getByLabel(/^title$/i).fill('Counter closed on Friday');
  await dialog.getByLabel(/^message$/i).fill('The office counter is closed all day on Friday.');

  // The button counts what it will actually reach, rather than saying "Send".
  await expect(dialog.getByRole('button', { name: /send to \d+ phones/i })).toBeEnabled();

  // And the thing that cannot be taken back says so before it is pressed.
  await expect(dialog.getByText(/cannot be taken back/i)).toBeVisible();
});

/**
 * **The page does not scroll; the columns do.**
 *
 * Only a browser can prove this. jsdom computes no layout, so `splitPane.test.tsx` can
 * only assert that the classes which *make* it true are present on the right elements —
 * and every one of them fails silently: `overflow-hidden` on a container that never
 * overflows, `min-h-0` on a column that had room anyway.
 *
 * Measured rather than asserted by class, and in two parts, because "nothing scrolls
 * anywhere" would also pass on a screen whose content simply fitted:
 *
 *  1. **`main` does not scroll**, which is the property being bought.
 *  2. **The settings column does**, which proves the first one is a layout rule rather
 *     than a short page. The triggers card is a form of eight rows plus a paragraph, and
 *     it overflows at this viewport — before the fix that overflow went to `main` and
 *     took the log off screen with it.
 *
 * The log's own overflow is deliberately **not** asserted: the fixture has three sends, so
 * its `DataTable` scroller does not need a scrollbar at 1366×768 and demanding one would
 * be a test of the fixture. What matters is that the card cannot outgrow the pane, which
 * is checked as a box rather than as a scroll height.
 */
test('scrolls each column on its own rather than the whole page', async ({ page }) => {
  await signIn(page);
  await page.goto('/notifications');
  await expect(page.getByRole('table', { name: 'Notifications' })).toBeVisible({
    timeout: 15_000,
  });

  const main = page.locator('main#main');

  // `main` is the page scroller — see `AppShell`. Nothing on this screen may push it.
  // One pixel of slack for sub-pixel rounding on a fractional device ratio.
  expect(await main.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);

  // The settings column reads down on its own, so reaching a toggle never moves the list.
  const settings = page.locator('main#main .lg\\:overflow-y-auto').first();
  await expect(settings).toBeVisible();
  expect(await settings.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);

  // And the log stays inside the window rather than hanging below the fold.
  const card = page.locator('table[aria-label="Notifications"] >> xpath=ancestor::*[contains(@class,"flex-1")][1]');
  const cardBox = await card.boundingBox();
  const mainBox = await main.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(mainBox!.y + mainBox!.height + 1);
});
