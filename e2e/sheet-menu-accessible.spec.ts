import { test, expect } from '@playwright/test';

test('sheet menu has accessible title and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('DialogTitle')) {
      errors.push(msg.text());
    }
  });

  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');

  // Trigger sheet menu on mobile view
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('button:has-text("Menu")');

  // Wait for sheet to open
  await page.waitForSelector('[role="dialog"]');

  // Check that VisuallyHidden title exists in DOM (screen reader accessible)
  const visuallyHiddenTitle = await page.locator('text=m4trix').first();
  await expect(visuallyHiddenTitle).toBeAttached();

  // Verify no DialogTitle console error
  expect(errors).toHaveLength(0);
});
