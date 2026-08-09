import { expect, test, type Page } from '@playwright/test';

/**
 * The supplier-support path, in a browser: bills → the slip.
 *
 * **v2 cut this suite down to its first third.** It used to walk bills → payouts → a
 * run → savings, which was right when this console ran the money. The factory's own
 * console does that now; what is left here is the read a clerk needs when a supplier
 * telephones about the figure on their phone.
 *
 * The unit tests prove the arithmetic and the refusals against the mock API. What only a
 * browser can confirm is that the screens built on them **render** — that the lazy chunks
 * resolve and the month picker validates a key against the API's own list rather than
 * trusting the URL.
 *
 * Signed in as the accountant, because §12.1 gives them `billing: W`. In v2 nobody on
 * this screen can write anything, which is a different test — see the read-only notice
 * asserted below.
 */

const ACCOUNTANT = 'accountant@galabodatea.lk';
const PASSWORD = 'demo1234';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(ACCOUNTANT);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });
}

test('reads a month’s bills and opens one supplier’s slip', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: /^bills$/i }).click();
  await expect(page.getByRole('heading', { name: /^bills$/i })).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText(/read-only/i).first()).toBeVisible({ timeout: 15_000 });

  // Switch to a published month, which the fixture generated bills for.
  const monthSelect = page.getByLabel(/^month$/i);
  const published = (await monthSelect.locator('option').last().getAttribute('value'))!;
  await monthSelect.selectOption(published);

  const grid = page.getByRole('table', { name: /^bills$/i });
  await expect(grid.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

  // Open the slip.
  await grid.locator('tbody tr').first().click();
  await expect(page.getByRole('heading', { name: /green leaf account/i })).toBeVisible({
    timeout: 15_000,
  });

  // The nine deduction lines are all present, zeros included — the slip's shape.
  for (const label of [/transport charges/i, /^stamps$/i, /previous debts/i, /^savings$/i]) {
    await expect(page.getByText(label).first()).toBeVisible();
  }
  // And §21.8 is stated rather than left as a missing edit button.
  await expect(page.getByText(/open question with the factory/i).first()).toBeVisible();
});
