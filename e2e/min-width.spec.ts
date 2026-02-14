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

  // (optional) menu toggle presence can vary by route; skip UI toggle check here
  // ensure the page finished loading by checking the container exists
  await expect(page.locator('.container, .app-min-width-wrapper')).toHaveCount(1);
});
