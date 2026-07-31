import { expect, test } from '@playwright/test';

/**
 * The three things only a browser can confirm.
 *
 * Run with `npm run e2e` from the workspace root, after
 * `npx playwright install chromium` once.
 */

const CLERK = 'clerk@galabodatea.lk';
const PASSWORD = 'demo1234';

test('signs in and reaches the dashboard', async ({ page }) => {
  await page.goto('/sign-in');

  // Proves the mock service worker registered: without it every request falls
  // through to a domain nobody owns, and the factory name never resolves.
  await expect(page.getByRole('heading', { name: /sign in to the console/i })).toBeVisible();

  await page.getByLabel(/^email$/i).fill(CLERK);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/galaboda/i).first()).toBeVisible();
});

test('survives a page reload', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(CLERK);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });

  // The access token is held in memory by design, so a fresh document has none
  // and the session must be recovered from the refresh cookie. If this fails,
  // every browser refresh — and every deep link — bounces the clerk to sign-in.
  await page.reload();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });

  // And a deep link opened cold, which is the same path.
  await page.goto('/suppliers');
  await expect(page.getByRole('heading', { name: /^suppliers$/i })).toBeVisible({
    timeout: 15_000,
  });

  // Signing out must not leave a session behind on a shared office machine.
  await page.getByRole('button', { name: new RegExp(CLERK.split('@')[0]!, 'i') }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await expect(page.getByRole('heading', { name: /sign in to the console/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /sign in to the console/i })).toBeVisible();
});

test('applies the tenant brand as CSS custom properties', async ({ page }) => {
  await page.goto('/sign-in');

  // The whole white-label mechanism in one assertion: Tailwind's `--color-primary`
  // resolves through `--brand-color-primary`, which is written at runtime from the
  // tenant's config. If this is Galaboda's green, the bridge works end to end.
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand-color-primary').trim(),
  );
  expect(primary.toUpperCase()).toBe('#2E8B57');

  // And a different tenant repaints without a rebuild.
  await page.goto('/sign-in?tenant=hillcountry');
  const hillcountry = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand-color-primary').trim(),
  );
  expect(hillcountry.toUpperCase()).toBe('#1B5E20');
});

test('a reduced-feature tenant loses the queues it does not use', async ({ page }) => {
  // `highland` has no loans and no manure (mirroring mobile's clientB), so those
  // rows must be absent rather than empty — "otherwise a clerk is staffing an
  // inbox nothing can reach".
  await page.goto('/sign-in?tenant=highland');
  await page.getByLabel(/^email$/i).fill(CLERK);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });

  const nav = page.getByRole('navigation').first();
  await expect(nav.getByText(/change requests/i)).toBeVisible();
  await expect(nav.getByText(/^loans$/i)).toHaveCount(0);
  await expect(nav.getByText(/^manure$/i)).toHaveCount(0);
});
