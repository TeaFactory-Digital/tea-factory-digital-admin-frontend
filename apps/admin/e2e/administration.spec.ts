import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The Administration section in a browser: configuration, users and roles, reports.
 *
 * The unit suites prove the refusals against the mock API. What only a browser can confirm is
 * the part of each module that **is** a browser thing, and in all three cases it is the same
 * thing: a consequence has to be visible *before* the control is used.
 *
 *  - M14: the cost of a flag appears while it is being considered, not after it is pressed.
 *  - M15: "only way back in" stops being true the moment somebody else is given the role, and
 *    the button that was withheld comes back.
 *  - M16: the answer comes first, and a total is worked out from the totals rather than
 *    averaged from the months.
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
  await expect(page.getByRole('heading', { name: /dashboard|good (morning|afternoon|evening)/i })).toBeVisible({ timeout: 15_000 });
}

/**
 * The toast, and not the screen-reader announcement Radix renders beside it.
 *
 * Both carry the same words, so an unscoped `getByText` is ambiguous, and matching the
 * announcement instead would pass while the visible toast was missing. The announcement is a
 * `span[role=status]`; the toast itself is the `li` Radix puts in the viewport.
 */
const toast = (page: Page) => page.locator('li[data-state="open"]');

/**
 * Choose an option from one of the console's dropdowns.
 *
 * They are Radix popups now, not native `<select>`s (`components/ui/Select.tsx`), so
 * `selectOption` has nothing to act on: open the trigger, then pick the option by name.
 */
async function choose(page: Page, trigger: Locator, option: RegExp) {
  await trigger.click();
  await page.getByRole('option', { name: option }).click();
}

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
  // AC-12, stated on the screen it is about: behind "About this screen", which opens on
  // hover or focus.
  await page.getByRole('button', { name: /^about this screen$/i }).hover();
  await expect(page.getByRole('tooltip')).toContainText(/no new version of the console/i);

  await page.getByRole('button', { name: /^features/i }).click();

  const savings = page.getByRole('checkbox', { name: /savings scheme/i });
  await expect(savings).toBeChecked();
  await savings.uncheck();

  /**
   * The refusal, with the figure: computed in the browser from the same `configImpact` the
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
  // A config save reaches other modules, so it is confirmed first.
  const confirm = page.getByRole('dialog', { name: /save these configuration changes/i });
  await confirm.getByRole('button', { name: /save this section/i }).click();

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
  // Deleting exists now, but waits, and never takes a name off the records it signed.
  await page.getByRole('button', { name: /^how deleting works$/i }).hover();
  await expect(page.getByRole('tooltip')).toContainText(/deleting waits 3 days/i);
  await expect(page.getByRole('tooltip')).toContainText(/name stays on every record/i);

  // Add a second one.
  await page.getByRole('button', { name: /add a user/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/full name/i).fill('Nimal Weerasinghe');
  await dialog.getByLabel(/^email$/i).fill('nimal@galabodatea.lk');
  await dialog.getByRole('checkbox', { name: /factory administrator/i }).check();

  await dialog.getByRole('button', { name: /add a user/i }).click();
  // And confirmed, in a second dialog on top of the form.
  const confirm = page.getByRole('dialog').filter({ hasText: /create a new console account/i });
  await confirm.getByRole('button', { name: /add a user/i }).click();

  await expect(toast(page)).toContainText(/can now sign in/i, { timeout: 15_000 });

  // The first password is shown once, in the form, and the form stays until it is noted.
  await expect(dialog.getByText(/this password is shown once/i)).toBeVisible();
  await dialog.getByRole('button', { name: /i have written it down/i }).click();
  await expect(dialog).toHaveCount(0);

  /**
   * And the badge is gone from **both** rows: `isLastAdministrator` is derived per read, so
   * it stops being true the moment somebody else holds the role. A stored flag would go on
   * withholding the button afterwards.
   */
  await expect(grid.getByText(/only way back in/i)).toHaveCount(0);

  const newRow = grid.locator('tbody tr').filter({ hasText: 'nimal@galabodatea.lk' });
  await expect(newRow.getByRole('button', { name: /^suspend$/i })).toBeEnabled();
});

test('refuses the matrix edit that would leave nobody able to get back in', async ({ page }) => {
  await signIn(page);
  await page.goto('/users?view=roles');

  const matrix = page.getByRole('table', { name: /what each role may do/i });
  await expect(matrix).toBeVisible({ timeout: 15_000 });

  // Shipped or diverged, said once, otherwise a reader has to compare fifteen rows against
  // a document to find out.
  await expect(page.getByText(/standard roles/i)).toBeVisible();
  // The recovery row is marked, because its column of dashes is the lockout.
  await expect(matrix.getByText(/at least one role must keep it/i).first()).toBeVisible();

  /**
   * Two roles grant `usersAndRoles: W` by default, so removing the first is a legitimate
   * narrowing and is saved…
   */
  await choose(page, matrix.getByLabel(/users & roles for platform administrator/i), /^-$/);
  await expect(toast(page)).toContainText(/platform administrator updated/i, { timeout: 15_000 });
  await expect(page.getByText(/changed for this factory/i)).toBeVisible();

  /**
   * …and removing the second is the lockout nobody thinks of. Every user keeps their roles
   * while the roles stop granting recovery, so no user record changes, which is why the
   * guard is on the proposed matrix rather than on any row.
   */
  await choose(page, matrix.getByLabel(/users & roles for factory administrator/i), /^-$/);
  // `.last()` because the first save's toast is still on screen: the refusal is the new one.
  await expect(toast(page).last()).toContainText(/would lock everybody out/i, { timeout: 15_000 });
  await expect(toast(page).last()).toContainText(/nobody could ever change this back/i);

  // Refused before the request went, so the cell still holds its value.
  await expect(matrix.getByLabel(/users & roles for factory administrator/i)).toHaveText(/^change$/i);
});

/**
 * v2 left one generic report, app use, and gave it a screen of its own: the answer for the
 * period, the trend, then the numbers. Credit and savings are tabs beside it.
 */
test('reports lead with the answer, and total from the totals', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: /^reports$/i }).click();
  await expect(page.getByRole('heading', { name: /^reports$/i, level: 1 })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('tab', { name: /^app use$/i })).toHaveAttribute('aria-selected', 'true');

  // The report says what it counts. A figure with no definition is one somebody quotes wrong.
  await page.getByRole('button', { name: /^what is counted$/i }).hover();
  await expect(page.getByRole('tooltip')).toContainText(/in the app means the supplier sent it/i);

  /**
   * The answer runs on arrival, for the last six months: no button to press for an answer
   * already available.
   */
  await expect(page.getByRole('button', { name: /^last 6 months$/i })).toHaveAttribute('aria-pressed', 'true');
  const summary = page.getByRole('region', { name: /summary for the period/i });
  await expect(summary).toBeVisible({ timeout: 15_000 });
  await expect(summary).toContainText(/share from the app/i);
  await expect(summary).toContainText(/%/);

  const numbers = page.getByRole('table', { name: /^the numbers$/i });
  await expect(numbers.locator('tbody tr').first()).toBeVisible();
  // A month is data, not a key: it must render as a month.
  await expect(numbers.getByText(/reports\.(metric|column|appUse)\./)).toHaveCount(0);

  /**
   * The totals row. Every count adds up, and the share is worked out **from the totals**:
   * an average of monthly percentages would weigh a quiet month the same as a busy one.
   */
  const totals = numbers.locator('tfoot tr');
  await expect(totals).toContainText(/period total/i);
  const cells = totals.locator('td');
  await expect(cells.nth(1)).not.toBeEmpty(); // in the app
  await expect(cells.nth(2)).not.toBeEmpty(); // at the office
  await expect(cells.nth(3)).not.toBeEmpty(); // all requests
  await expect(cells.nth(4)).toContainText(/%/); // share
  await expect(summary).toContainText((await cells.nth(4).textContent())!.trim());

  // A download, now, of the same columns and months as on screen.
  await expect(page.getByRole('button', { name: /download csv/i })).toBeVisible();

  // A different period swaps the figures rather than the screen: at most the three months
  // that have requests in them.
  await page.getByRole('button', { name: /^last 3 months$/i }).click();
  await expect(page.getByRole('button', { name: /^last 3 months$/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(numbers.locator('tbody tr').first()).toBeVisible();
  expect(await numbers.locator('tbody tr').count()).toBeLessThanOrEqual(3);
});

test('keeps the report tab in the address, and shows the credit report the server serves', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: /^reports$/i, level: 1 })).toBeVisible({
    timeout: 15_000,
  });

  // One tab per report, so a link to one opens on it.
  const tabs = page.getByRole('tablist', { name: /^reports$/i });
  await expect(tabs.getByRole('tab')).toHaveText([/app use/i, /credit & tea packets/i, /savings/i]);
  await tabs.getByRole('tab', { name: /credit & tea packets/i }).click();
  await expect(page).toHaveURL(/[?&]report=credit\b/);

  // Served by the API (and the mock): the summary tiles, not "not available on this server"
  // and not an error. (A report the API does not serve answers 404 and is said so.)
  await expect(page.getByRole('group', { name: /summary/i }).or(page.getByText(/advances/i).first())).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/not available on this server/i)).toHaveCount(0);
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: /credit & tea packets/i })).toHaveAttribute(
    'aria-selected',
    'true',
    { timeout: 15_000 },
  );
});

/**
 * The payout file layout this used to configure went with payouts (v2 has no payout runs),
 * so the closest screen left is the one that decides what a bill pays and is numbered, and
 * it is the same kind of check: the example follows the setting before anything is saved,
 * and a value the bill cannot carry is refused in the form.
 */
test('configures how a bill is paid and numbered, and shows the slip it will produce', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/configuration?section=billCalculation');
  await expect(page.getByRole('heading', { name: /^configuration$/i })).toBeVisible({
    timeout: 15_000,
  });

  // With the sync off (the default), the console calculates the bills, so its rounding and
  // numbering are the ones printed.
  await expect(page.getByLabel(/where the bills come from/i)).toHaveText(/calculated in this console/i, {
    timeout: 15_000,
  });

  // The example is worked on the factory's own slip balance, so a reader can check it
  // against a paper bill.
  const example = page.getByText(/a balance of rs\. 68,226\.91 is paid as/i);
  await expect(example).toContainText('Rs. 68,226.00');
  await expect(example).toContainText('Rs. 0.91 carried forward');

  // Change the unit, and the example follows immediately.
  await choose(page, page.getByLabel(/pay the balance in/i), /rs\. 10 units/i);
  await expect(example).toContainText('Rs. 68,220.00');
  await expect(example).toContainText('Rs. 6.91 carried forward');

  // The factory's own numbers continue from its last paper bill.
  await expect(example).toContainText(/numbered GL\/YYYY-MM\/NNNN/);
  await page.getByLabel(/next bill number/i).fill('210870');
  await expect(example).toContainText(/the next new bill is numbered \S*210870/i);
  await expect(page.getByRole('button', { name: /save this section/i })).toBeEnabled();

  // A serial the bill cannot carry is refused before anything is sent.
  await page.getByLabel(/next bill number/i).fill('12.5');
  await expect(page.getByText(/enter a whole number from 1 to/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /save this section/i })).toBeDisabled();
});
