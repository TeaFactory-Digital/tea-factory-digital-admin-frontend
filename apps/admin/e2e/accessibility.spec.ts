import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Every screen, checked by axe against WCAG 2.2 A and AA.
 *
 * This is the machine half of an accessibility pass: missing names, labels and roles,
 * contrast, landmarks, focusable things a keyboard cannot reach. It cannot judge whether a
 * screen reader's reading order makes sense or an announcement is useful; that is the
 * manual pass with NVDA and VoiceOver (docs/v2/accessibility.md).
 *
 * Each screen is checked in light and dark, because the dark palette is a second set of
 * colours with its own contrast.
 */

const ADMIN = 'factoryadmin@galabodatea.lk';
/** The queues are the manager's: the administrator sees "not allowed" there. */
const MANAGER = 'manager@galabodatea.lk';
const PASSWORD = 'demo1234';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const SCREENS: Array<{ path: string; openFirst?: boolean }> = [
  { path: '/' },
  { path: '/suppliers', openFirst: true },
  { path: '/deliveries' },
  { path: '/rates' },
  { path: '/bills' },
  { path: '/change-requests', openFirst: true },
  { path: '/credit', openFirst: true },
  { path: '/tea-packets' },
  { path: '/inquiries', openFirst: true },
  { path: '/news', openFirst: true },
  { path: '/banners', openFirst: true },
  { path: '/content' },
  { path: '/notifications' },
  { path: '/reports' },
  { path: '/audit' },
  { path: '/configuration' },
  { path: '/users' },
  { path: '/profile' },
  { path: '/data-status' },
];

async function signIn(page: Page, email = ADMIN) {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard|good (morning|afternoon|evening)/i })).toBeVisible({ timeout: 15_000 });
}

/** The violations, one line each, so a failure says what and where without a trace. */
async function audit(page: Page, label: string): Promise<string[]> {
  // Animations finished, so contrast is measured on the final colours.
  await page.waitForTimeout(400);
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return result.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${label} · ${violation.id} (${violation.impact}) · ${node.target.join(' ')} · ${node.failureSummary?.split('\n')[1]?.trim() ?? ''}`,
    ),
  );
}

/** One `h1` per screen: the first thing a screen-reader user jumps to, to learn where they are. */
async function headingProblems(page: Page, label: string): Promise<string[]> {
  const count = await page.getByRole('heading', { level: 1 }).count();
  return count === 1 ? [] : [`${label} · h1 count ${count}`];
}

test('the sign-in screen', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: /sign in to the console/i })).toBeVisible();
  expect(await audit(page, '/sign-in')).toEqual([]);
});

const QUEUES: typeof SCREENS = [
  { path: '/change-requests', openFirst: true },
  { path: '/credit', openFirst: true },
  { path: '/tea-packets' },
  { path: '/inquiries', openFirst: true },
  { path: '/suppliers', openFirst: true },
];

for (const [who, email, screens] of [
  ['the administrator', ADMIN, SCREENS],
  ['the manager', MANAGER, QUEUES],
] as const)
for (const scheme of ['light', 'dark'] as const) {
  test(`every screen ${who} opens, ${scheme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: scheme });
    await signIn(page, email);
    const found: string[] = [];
    for (const screen of screens) {
      await page.goto(screen.path);
      await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
      // Loaded: the screen's data in, not a skeleton (whose grey blocks have no text to check).
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      found.push(...(await headingProblems(page, `${screen.path} (${scheme})`)));
      found.push(...(await audit(page, `${screen.path} (${scheme})`)));
      if (screen.openFirst) {
        // The first record's own page, through the list's link, as a clerk would open it.
        const link = page.getByRole('main').getByRole('link').filter({ hasNotText: /^$/ }).first();
        if (await link.count()) {
          await link.click();
          await page.waitForURL((url) => url.pathname !== screen.path, { timeout: 15_000 });
          await page.waitForTimeout(800);
          found.push(...(await headingProblems(page, `${screen.path}/:id (${scheme})`)));
          found.push(...(await audit(page, `${screen.path}/:id (${scheme})`)));
        }
      }
    }
    expect(found).toEqual([]);
  });
}
