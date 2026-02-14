import { test, expect } from '@playwright/test';

test('app enforces min-width on document and wrapper', async ({ page }) => {
  await page.goto('/');

  // check root/document min-width
  const rootMin = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('min-width'));
  expect(rootMin.trim()).toBe('337px');

  // ensure wrapper enforces min-width and content width is >= 337
  const wrapperWidth = await page.evaluate(() => {
    const w = document.querySelector('.app-min-width-wrapper') as HTMLElement | null;
    return w ? Math.round(w.getBoundingClientRect().width) : null;
  });
  expect(wrapperWidth).toBeGreaterThanOrEqual(337);

  // ensure the menu (sidebar toggle) is visible and usable
  const toggle = page.locator('button[aria-label="Toggle Sidebar"], .sidebar-toggle, button:has-text("Menu")').first();
  await expect(toggle).toBeVisible({ timeout: 2000 });
});
