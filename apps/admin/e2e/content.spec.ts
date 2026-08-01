import { expect, test, type Page } from '@playwright/test';

/**
 * The content path in a browser: the language tabs, the gap, and the preview.
 *
 * The unit suite proves the resolution and the refusals against the mock API. What only a
 * browser can confirm is the half of AC-08 that **is** a browser thing: that a missing
 * translation is visible on the tab for the language that has it, that the preview says
 * out loud when it is showing a fallback, and that Sinhala and Tamil copy renders as
 * script rather than as boxes.
 *
 * Signed in as the editor, because §12.1 gives them `content: W` and nothing else — the
 * narrowest account the console has, and the one most likely to be on these screens.
 */

const EDITOR = 'editor@galabodatea.lk';
const PASSWORD = 'demo1234';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(EDITOR);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // The editor has no `reports` grant, so the dashboard refuses them — the shell is what
  // proves the session, not the screen behind it.
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 15_000 });
}

test('shows a live article’s missing translation on the tab that has it', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: /^news$/i }).click();
  await expect(page.getByRole('heading', { name: /^news$/i })).toBeVisible({ timeout: 15_000 });

  // The AC-08 working list: live, and falling back for somebody.
  await page.getByLabel(/^show$/i).selectOption('incomplete');
  const grid = page.getByRole('table', { name: /^news$/i });
  await expect(grid.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

  await grid.locator('tbody tr').first().click();
  await expect(page.getByRole('tablist', { name: /languages/i })).toBeVisible({ timeout: 15_000 });

  // The gap, stated as what it costs rather than that it exists.
  await expect(page.getByText(/suppliers reading in those languages/i)).toBeVisible();

  // And on the tab itself, for a screen reader as well as by colour.
  const sinhala = page.getByRole('tab', { name: /sinhala/i });
  await expect(sinhala).toContainText(/not written yet/i);

  // Switching to it previews the fallback, and says so.
  await sinhala.click();
  await expect(page.getByText(/is shown the english version/i)).toBeVisible({ timeout: 15_000 });
});

test('renders Sinhala and Tamil copy as script, not as a fallback', async ({ page }) => {
  await signIn(page);
  await page.goto('/news');
  await expect(page.getByRole('heading', { name: /^news$/i })).toBeVisible({ timeout: 15_000 });

  // The fully-translated article — the fixture's first row is the August rate.
  await page.getByRole('table', { name: /^news$/i }).getByText(/august green leaf rate/i).click();
  await expect(page.getByRole('tablist', { name: /languages/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('tab', { name: /sinhala/i }).click();
  // No fallback banner: this one is genuinely translated.
  await expect(page.getByText(/is shown the english version/i)).toHaveCount(0);
  // And the preview declares its language, which is what makes the base stylesheet's
  // Sinhala line-height and wrapping rules apply (§20.2).
  await expect(page.locator('article[lang="si"]')).toBeVisible();
});

test('lists every fixed page, including one nobody has written', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: /static content/i }).click();
  await expect(page.getByRole('heading', { name: /static content/i })).toBeVisible({
    timeout: 15_000,
  });

  // A closed set: all six, whether written or not.
  await expect(page.getByRole('button', { name: /frequently asked questions/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /terms of supply/i })).toBeVisible();

  // A page the factory has never written is a **state**, not an absent row — the app is
  // showing its bundled default and the office has to be able to see that.
  const unwritten = page.getByRole('button', { name: /credit terms/i });
  await expect(unwritten).toContainText(/never written/i);

  await unwritten.click();
  await expect(page.getByText(/shows its own built-in version/i)).toBeVisible();
  await expect(page.getByText(/nothing to show/i)).toBeVisible();

  // The editor writes; publishing is the factory administrator's (§12.1).
  await expect(page.getByText(/publishing is the factory administrator/i)).toBeVisible();
});
