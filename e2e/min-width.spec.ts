import { test, expect } from '@playwright/test';

test('app enforces min-width on document and wrapper', async ({ page }) => {
  await page.goto('/');

  // check root/document min-width
  const rootMin = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('min-width')
  );
  expect(rootMin.trim()).toBe('401px');

  // ensure wrapper enforces min-width and content width is >= 401
  const wrapperWidth = await page.evaluate(() => {
    const w = document.querySelector('.app-min-width-wrapper') as HTMLElement | null;
    return w ? Math.round(w.getBoundingClientRect().width) : null;
  });
  expect(wrapperWidth).toBeGreaterThanOrEqual(401);

  // ensure the page finished loading by waiting for the app wrapper to appear
  await page.waitForSelector('.app-min-width-wrapper', { timeout: 5000 });
});
