import { expect, test, type Page } from '@playwright/test';

/**
 * The Administration section in a browser: configuration, users and roles, reports.
 *
 * The unit suites prove the refusals against the mock API. What only a browser can confirm is
 * the part of each module that **is** a browser thing — and in all three cases it is the same
 * thing: a consequence has to be visible *before* the control is used.
 *
 *  - M14: the cost of a flag appears while it is being considered, not after it is pressed.
 *  - M15: "only way back in" stops being true the moment somebody else is given the role, and
 *    the button that was withheld comes back.
 *  - M16: a total is printed only under the columns that add up, and the gaps are the point.
 *
 * Signed in as the factory administrator, because §12.1 gives `flagsAndBranding: W` and
 * `usersAndRoles: W` to them and nobody else. A manager sees all three screens read-only,
 * which is a different test.
 */

const ADMIN = 'factoryadmin@galabodatea.lk';
const PASSWORD = 'demo1234';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(ADMIN);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });
}

/**
 * The toast, and not the screen-reader announcement Radix renders beside it.
 *
 * Both carry the same words, so an unscoped `getByText` is ambiguous — and matching the
 * announcement instead would pass while the visible toast was missing. The announcement is a
 * `span[role=status]`; the toast itself is the `li` Radix puts in the viewport.
 */
const toast = (page: Page) => page.locator('li[data-state="open"]');

test('states what a flag costs before it can be turned off, and refuses the ones holding money', async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole('link', { name: /^configuration$/i }).click();
  await expect(page.getByRole('heading', { name: /^configuration$/i })).toBeVisible({
    timeout: 15_000,
  });

  // The tenant id is shown and is not a field: it comes from the subdomain and everything
  // else is keyed on it.
  await expect(page.locator('#main').getByText('galaboda', { exact: true })).toBeVisible();
  // AC-12, stated on the screen it is about.
  await expect(page.getByText(/no new version of the console/i)).toBeVisible();

  await page.getByRole('button', { name: /^features/i }).click();

  const savings = page.getByRole('checkbox', { name: /savings scheme/i });
  await expect(savings).toBeChecked();
  await savings.uncheck();

  /**
   * The refusal, with the figure — computed in the browser from the same `configImpact` the
   * API refuses with, so the screen and the server can never name different reasons.
   */
  await expect(page.getByText(/suppliers have money in the savings scheme/i)).toBeVisible();
  await expect(page.getByText(/this cannot be saved/i).first()).toBeVisible();

  const save = page.getByRole('button', { name: /save this section/i });
  await expect(save).toBeDisabled();
  // "Nothing to save" and "this would hide money" are not the same message.
  await expect(page.getByText(/fix the problem above before saving/i)).toBeVisible();

  // A flag that holds nothing is a choice the factory is entitled to make: the promotional
  // banner comes off with a warning rather than a refusal.
  await savings.check();
  await page.getByRole('checkbox', { name: /promotional banner/i }).uncheck();
  await expect(page.getByText(/everyone loses this from the menu/i)).toBeVisible();
  await expect(save).toBeEnabled();
});

test('saves one section and says what else changed', async ({ page }) => {
  await signIn(page);
  await page.goto('/configuration?section=factory');
  await expect(page.getByRole('heading', { name: /^configuration$/i })).toBeVisible({
    timeout: 15_000,
  });

  const hours = page.getByLabel(/^office hours$/i);
  await expect(hours).toBeVisible({ timeout: 15_000 });
  await hours.fill('8.00 a.m. to 3.30 p.m.');

  await page.getByRole('button', { name: /save this section/i }).click();

  // The toast says the change is already live, because a config save is the one edit whose
  // effect is mostly somewhere the reader is not looking.
  await expect(toast(page)).toContainText(/configuration saved/i, { timeout: 15_000 });
  await expect(toast(page)).toContainText(/no reload needed/i);
});

test('stops withholding the suspend button once somebody else can get back in', async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole('link', { name: /^users & roles$/i }).click();
  await expect(page.getByRole('heading', { name: /^users & roles$/i })).toBeVisible({
    timeout: 15_000,
  });

  const grid = page.getByRole('table', { name: /^users & roles$/i });
  await expect(grid.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

  /**
   * In this fixture the only administrator is also the person reading the screen, which is
   * exactly the situation the badge exists for: a factory of one is one suspension away from
   * having no console.
   */
  await expect(grid.getByText(/only way back in/i)).toHaveCount(1);
  await expect(page.getByText(/never deleted/i)).toBeVisible();

  // Add a second one.
  await page.getByRole('button', { name: /add a user/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/full name/i).fill('Nimal Weerasinghe');
  await dialog.getByLabel(/^email$/i).fill('nimal@galabodatea.lk');
  await dialog.getByRole('checkbox', { name: /factory administrator/i }).check();

  // The obligation is stated rather than enforced here: a user cannot enrol a second factor
  // before they have an account.
  await expect(dialog.getByText(/two-factor/i).first()).toBeVisible();
  await dialog.getByRole('button', { name: /add a user/i }).click();

  await expect(toast(page)).toContainText(/can now sign in/i, { timeout: 15_000 });

  /**
   * And the badge is gone from **both** rows — `isLastAdministrator` is derived per read, so
   * it stops being true the moment somebody else holds the role. A stored flag would go on
   * withholding the button afterwards.
   */
  await expect(grid.getByText(/only way back in/i)).toHaveCount(0);

  const newRow = grid.locator('tbody tr').filter({ hasText: 'nimal@galabodatea.lk' });
  await expect(newRow.getByText(/two-factor not set up/i)).toBeVisible();
  await expect(newRow.getByRole('button', { name: /^suspend$/i })).toBeEnabled();
});

test('refuses the matrix edit that would leave nobody able to get back in', async ({ page }) => {
  await signIn(page);
  await page.goto('/users?view=roles');

  const matrix = page.getByRole('table', { name: /what each role may do/i });
  await expect(matrix).toBeVisible({ timeout: 15_000 });

  // Shipped or diverged, said once — otherwise a reader has to compare fifteen rows against
  // a document to find out.
  await expect(page.getByText(/standard roles/i)).toBeVisible();
  // The recovery row is marked, because its column of dashes is the lockout.
  await expect(matrix.getByText(/at least one role must keep it/i).first()).toBeVisible();

  /**
   * Two roles grant `usersAndRoles: W` by default, so removing the first is a legitimate
   * narrowing and is saved…
   */
  await matrix.getByLabel(/users & roles for platform administrator/i).selectOption('none');
  await expect(toast(page)).toContainText(/platform administrator updated/i, { timeout: 15_000 });
  await expect(page.getByText(/changed for this factory/i)).toBeVisible();

  /**
   * …and removing the second is the lockout nobody thinks of. Every user keeps their roles
   * while the roles stop granting recovery, so no user record changes — which is why the
   * guard is on the proposed matrix rather than on any row.
   */
  await matrix.getByLabel(/users & roles for factory administrator/i).selectOption('none');
  // `.last()` because the first save's toast is still on screen — the refusal is the new one.
  await expect(toast(page).last()).toContainText(/would lock everybody out/i, { timeout: 15_000 });
  await expect(toast(page).last()).toContainText(/nobody could ever change this back/i);

  // Refused before the request went, so the cell still holds its value.
  await expect(matrix.getByLabel(/users & roles for factory administrator/i)).toHaveValue('write');
});

test('reports describe themselves, and total only the columns that add up', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: /^reports$/i }).click();
  // Level 1, because the rail's card header is a "Reports" heading too.
  await expect(page.getByRole('heading', { name: /^reports$/i, level: 1 })).toBeVisible({
    timeout: 15_000,
  });

  // Each report carries what defines it. A report with no citation is one somebody thought
  // would be useful.
  await expect(page.getByText(/§19\.2, via SupplierQuery/i)).toBeVisible();
  await expect(page.getByText(/§19\.3 — app adoption/i)).toBeVisible();
  // And §19.1 is stated where somebody would look for the fifth report.
  await expect(page.getByText(/need a separate reporting database/i)).toBeVisible();

  /**
   * The default report runs on arrival — no button to press for an answer already available.
   *
   * This assertion is the one that found a real defect: the month picker was fed from M5's
   * `GET /admin/bill-months`, and §12.1 gives this administrator `reports: R` with
   * `billing: none`. The screen rendered, the picker was empty, and it said "nothing to show
   * yet" for a report they are entitled to run.
   */
  const summary = page.getByRole('table', { name: /month summary/i });
  await expect(summary).toBeVisible({ timeout: 15_000 });
  await expect(summary.getByText(/where the month is/i)).toBeVisible();

  /**
   * The row label and its value are both keys, from **different namespaces**, and both used
   * to be translated as one — `t('reports.metric.' + value)` ran on every `text` column, which
   * translated the stage under the wrong prefix (`reports.metric.awaitingRate`, never defined)
   * and translated literal data in every other report (`reports.metric.5091`,
   * `reports.metric.MAKADURA`) that happened to share the `text` type. Asserting the rendered
   * words, not just "no raw key on screen", because a stale key can still read as English if
   * `t()` falls back to its argument.
   */
  await expect(summary.getByText(/^(collecting leaf|awaiting auction result|rate entered|bills generated|published)$/i)).toBeVisible();
  await expect(summary.getByText(/reports\.metric\./)).toHaveCount(0);

  await page.getByRole('button', { name: /leaf by collection point/i }).click();
  const byPoint = page.getByRole('table', { name: /leaf by collection point/i });
  await expect(byPoint.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

  // A collection point's name is data, not a key — it must render literally.
  await expect(byPoint.getByText(/^(makadura|deniyaya)$/i).first()).toBeVisible();
  await expect(byPoint.getByText(/reports\.metric\./)).toHaveCount(0);

  /**
   * The totals row, and the **gap in it** is the assertion. Kilos and weighings add up;
   * suppliers do not, because a grower who delivers to two points appears in both rows and a
   * sum would double-count people. The cell is blank rather than zero — a zero there is a
   * figure the office would quote.
   */
  const totals = byPoint.locator('tfoot tr');
  await expect(totals).toContainText(/total/i);
  const cells = totals.locator('td');
  await expect(cells.nth(1)).not.toBeEmpty(); // kilos
  await expect(cells.nth(2)).toBeEmpty(); // suppliers
  await expect(cells.nth(3)).not.toBeEmpty(); // weighings

  // §18.1 stated where somebody would look for a download button.
  await expect(page.getByText(/no download yet/i)).toBeVisible();

  // A report with a different parameter shape swaps the form rather than the screen.
  await page.getByRole('button', { name: /suppliers who have stopped/i }).click();
  await expect(page.getByLabel(/no leaf for at least/i)).toBeVisible({ timeout: 15_000 });
  const dormant = page.getByRole('table', { name: /suppliers who have stopped/i });
  await expect(dormant.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

  // A supplier code is data, not a key — the other `text` column this bug reached.
  await expect(dormant.getByText(/reports\.metric\./)).toHaveCount(0);
});


test('configures the payout file layout and previews what the bank will get', async ({ page }) => {
  await signIn(page);
  await page.goto('/configuration?section=payoutFile');
  await expect(page.getByRole('heading', { name: /^configuration$/i })).toBeVisible({
    timeout: 15_000,
  });

  /**
   * What the screen says it cannot do, before anything is edited.
   *
   * §21.17 is only *half* answered — a column template covers the CSV family and not a
   * fixed-width scheme with control totals, and somebody arriving here has been told their
   * bank wants "SLIPS". Configuring a template and believing it produced a SLIPS file is
   * the failure this sentence exists to prevent.
   */
  await expect(page.getByText(/cannot yet produce a fixed-width file/i)).toBeVisible();

  // The preview is the point of the screen: rendered from the same serialiser the API
  // writes the real file with, so a reader can check it against their bank's sheet.
  const preview = page.locator('pre').first();
  await expect(preview).toContainText('Supplier Code,Name,Account Number');
  // A supplier whose name carries a comma is quoted — the defect that shifts every
  // subsequent column and lands an amount in the branch field.
  await expect(preview).toContainText('"Perera, K."');

  // Change the amount format, and the sample follows immediately.
  await expect(preview).toContainText('4213.50');
  await page.getByLabel(/amounts written as/i).selectOption('cents');
  await expect(preview).toContainText('421350');
  await expect(preview).not.toContainText('4213.50');

  /**
   * The refusal, computed in the browser from the same `configImpact` the API refuses
   * with: a file with no amount column is a mailing list, not a payment instruction.
   */
  await page.getByRole('button', { name: /^remove amount$/i }).click();
  await expect(page.getByText(/not a payment instruction/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /save this section/i })).toBeDisabled();
  await expect(page.getByText(/fix the problems above/i)).toBeVisible();
});
