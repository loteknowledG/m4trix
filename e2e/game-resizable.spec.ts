import { test, expect } from '@playwright/test';

test.describe('game resizable panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/1');

    // Ensure the game page has rendered and the panels are available.
    await page.waitForSelector('[data-testid="game-sidebar-panel"]');
    await page.waitForSelector('[data-testid="game-chat-panel"]');
  });

  test('resizer can be dragged to resize the sidebar', async ({ page }) => {
    const handle = page.locator('[role="separator"]');

    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (!handleBox) throw new Error('Handle not found');

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      handleBox.x + handleBox.width / 2 + 150,
      handleBox.y + handleBox.height / 2,
      {
        steps: 10,
      }
    );
    await page.mouse.up();

    const afterHandleBox = await handle.boundingBox();
    expect(afterHandleBox).not.toBeNull();
    expect(Math.abs((afterHandleBox?.x ?? 0) - handleBox!.x)).toBeGreaterThan(0.5);
  });

  test('chat panel stays within viewport when resizing', async ({ page }) => {
    const chatPanel = page.locator('[data-testid="game-chat-panel"]');
    const handle = page.locator('[role="separator"]');

    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (!handleBox) throw new Error('Handle not found');

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      handleBox.x + handleBox.width / 2 - 200,
      handleBox.y + handleBox.height / 2,
      {
        steps: 10,
      }
    );
    await page.mouse.up();

    const chatBox = await chatPanel.boundingBox();
    expect(chatBox).not.toBeNull();

    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();
    expect(chatBox!.x + chatBox!.width).toBeLessThanOrEqual(viewportSize!.width);
  });
});
