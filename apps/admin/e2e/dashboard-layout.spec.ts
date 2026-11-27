/**
 * Arranging the dashboard in a real browser (27 November 2026). jsdom does not honour
 * `inert` or lay anything out, so the two things only a browser can show live here: a tile
 * inside the headline row can be reached and hidden while customising (its row's body once
 * swallowed every click), and a card dragged with the mouse lands where it was dropped and
 * stays there after a reload.
 */

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PASSWORD = 'demo1234';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel(/^email$/i).fill('manager@galabodatea.lk');
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('button', { name: 'Customise' })).toBeVisible({ timeout: 15_000 });
});

const order = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-dashboard-slot]')].map((slot) => slot.dataset.dashboardSlot),
  );

test('hides a headline tile while customising, and the row closes up', async ({ page }) => {
  await page.getByRole('button', { name: 'Customise' }).click();
  await page.getByRole('button', { name: 'Hide Devices' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  expect(await order(page)).not.toContain('devices');
  await expect(page.getByRole('button', { name: /Customise.*1 hidden/ })).toBeVisible();
});

test('moves a card with the mouse, and keeps it there after a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Customise' }).click();
  const handle = page.getByRole('button', { name: 'Move Waiting by queue' });
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 40, { steps: 5 });
  const target = page.locator('[data-dashboard-slot="today"]');
  await target.scrollIntoViewIfNeeded();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + 80, to.y + 40, { steps: 20 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Done' }).click();

  expect((await order(page))[0]).toBe('queueMix');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Customise' })).toBeVisible();
  expect((await order(page))[0]).toBe('queueMix');
});
