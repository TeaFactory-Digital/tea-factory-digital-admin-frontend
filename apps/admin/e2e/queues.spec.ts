import { expect, test, type Page } from '@playwright/test';

/**
 * The Queues section, in a real browser.
 *
 * The integration suite already proves the refusals and the arithmetic against the
 * mock API. What only a browser can confirm is that the two new modules are
 * *reachable* — lazily-loaded routes, a sidebar that links to them, and a badge
 * summing three queues behind one row. A route that 404s or a chunk that fails to
 * load is invisible to a jsdom test that imports the screen directly.
 */

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const PASSWORD = 'demo1234';
const MFA_CODE = '123456';

async function signIn(page: Page, email: string, mfa = false) {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  if (mfa) {
    // Manager and above: a correct password alone is not a session.
    await page.getByLabel(/^code$/i).fill(MFA_CODE);
    await page.getByRole('button', { name: /^verify$/i }).click();
  }

  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });
}

test('the Queues section links to all three of its modules', async ({ page }) => {
  await signIn(page, CLERK);

  const nav = page.getByRole('navigation').first();
  // No `Planned` chip on any of them any more — the section is finished.
  await expect(nav.getByRole('link', { name: /change requests/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /credit queues/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /inquiries/i })).toBeVisible();
});

test('opens the credit queue and shows the working behind one request', async ({ page }) => {
  await signIn(page, CLERK);

  await page.getByRole('navigation').first().getByRole('link', { name: /credit queues/i }).click();
  await expect(page.getByRole('heading', { name: /^credit queues$/i })).toBeVisible({
    timeout: 15_000,
  });

  const grid = page.getByRole('table', { name: /credit queues/i });
  await expect(grid.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

  await grid.locator('tbody tr').first().click();

  /**
   * AC-05 in the browser: the ceiling **and how it was reached**. A screen showing
   * only the limit cannot answer "the app said I could have more", which is the
   * dispute the whole module exists to prevent.
   */
  await expect(page.getByText(/how this was worked out/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/still available/i)).toBeVisible();
  await expect(page.getByText(/closed months of income/i)).toBeVisible();
});

test('tells a clerk that the credit decision is not theirs to give', async ({ page }) => {
  // §12.1 gives `creditRequests: R` to the clerk and `A` to the manager alone.
  // Hiding a lever that would 403 is the point; saying who *can* is the useful half.
  await signIn(page, CLERK);
  await page.goto('/credit');

  const grid = page.getByRole('table', { name: /credit queues/i });
  await expect(grid.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
  await grid.locator('tbody tr').first().click();

  await expect(page.getByText(/a manager decides credit requests/i)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0);
});

test('a manager gets the decision controls the clerk does not', async ({ page }) => {
  await signIn(page, MANAGER, true);
  await page.goto('/credit');

  const grid = page.getByRole('table', { name: /credit queues/i });
  await expect(grid.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
  await grid.locator('tbody tr').first().click();

  await expect(page.getByText(/how this was worked out/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^reject$/i })).toBeVisible();
});

test('opens an inquiry and offers both outcomes', async ({ page }) => {
  await signIn(page, CLERK);

  await page.getByRole('navigation').first().getByRole('link', { name: /inquiries/i }).click();
  await expect(page.getByRole('heading', { name: /^inquiries$/i })).toBeVisible({
    timeout: 15_000,
  });

  const grid = page.getByRole('table', { name: /^inquiries$/i });
  await expect(grid.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
  await grid.locator('tbody tr').first().click();

  // Answering and closing are different acts, and the screen says so.
  await expect(page.getByRole('button', { name: /^reply$/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /close unanswered/i })).toBeVisible();

  await page.getByRole('button', { name: /^reply$/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Disabled until there is an actual answer in it.
  await expect(dialog.getByRole('button', { name: /send reply/i })).toBeDisabled();
});

test('a factory that does not lend against income sees only the facilities it sells', async ({
  page,
}) => {
  /**
   * AC-07 from the browser side. `highland` buys advances but not loans or manure,
   * so the credit queue opens — one facility is enough — and offers no filter for
   * the two it does not sell. The endpoint refuses those rows as well; see
   * `src/test/credit.test.ts`, which is what makes this a policy rather than a
   * hidden option.
   */
  await page.goto('/sign-in?tenant=highland');
  await page.getByLabel(/^email$/i).fill(CLERK);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });

  // The override has to travel: the tenant is resolved from the URL on **every**
  // document load, so a bare `/credit` would re-resolve to the default factory and
  // this test would quietly assert nothing.
  await page.goto('/credit?tenant=highland');
  await expect(page.getByRole('heading', { name: /^credit queues$/i })).toBeVisible({
    timeout: 15_000,
  });

  const facilityFilter = page.getByLabel(/^facility$/i);
  await expect(facilityFilter.getByRole('option', { name: /^advance$/i })).toHaveCount(1);
  await expect(facilityFilter.getByRole('option', { name: /^loan$/i })).toHaveCount(0);
  await expect(facilityFilter.getByRole('option', { name: /^manure$/i })).toHaveCount(0);
});
