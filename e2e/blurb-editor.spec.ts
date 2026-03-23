import { test, expect } from '@playwright/test';

test('story blurb panel shows Quill toolbar and editor on first open', async ({ page }) => {
  await page.goto('/stories');

  const blurbButton = page.getByRole('button', { name: 'Open blurb panel' });
  await expect(blurbButton).toBeVisible({ timeout: 10000 });

  await blurbButton.click();
  await expect(page.getByText('Blurb')).toBeVisible({ timeout: 10000 });

  const toolbar = page.locator('.ql-toolbar');
  await expect(toolbar).toHaveCount(1);

  const editor = page.locator('.ql-editor');
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.fill('First open content');
  await expect(editor).toContainText('First open content');
});

test('story blurb panel does not duplicate toolbar after close and reopen', async ({ page }) => {
  await page.goto('/stories');

  const blurbButton = page.getByRole('button', { name: 'Open blurb panel' });
  await expect(blurbButton).toBeVisible({ timeout: 10000 });

  await blurbButton.click();
  await expect(page.getByText('Blurb')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.ql-toolbar')).toHaveCount(1);

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Blurb')).not.toBeVisible();

  await blurbButton.click();
  await expect(page.getByText('Blurb')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.ql-toolbar')).toHaveCount(1);
});
