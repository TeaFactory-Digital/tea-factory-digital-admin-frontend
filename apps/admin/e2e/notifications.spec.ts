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
