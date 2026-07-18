import { test, expect } from '@playwright/test';

test.describe('game visual novel stage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/1');

    await page.waitForSelector('[data-testid="game-vn-stage"]');
    await page.waitForSelector('[data-testid="game-sidebar-panel"]');
    await page.waitForSelector('[data-testid="game-chat-panel"]');
  });

  test('scene and dialogue share one fullscreen stage', async ({ page }) => {
    const stage = page.locator('[data-testid="game-vn-stage"]');
    const scene = page.locator('[data-testid="game-sidebar-panel"]');
    const chat = page.locator('[data-testid="game-chat-panel"]');

    await expect(stage).toBeVisible();
    await expect(scene).toBeVisible();
    await expect(chat).toBeVisible();

    const stageBox = await stage.boundingBox();
    const sceneBox = await scene.boundingBox();
    const chatBox = await chat.boundingBox();
    const viewport = page.viewportSize();

    expect(stageBox).not.toBeNull();
    expect(sceneBox).not.toBeNull();
    expect(chatBox).not.toBeNull();
    expect(viewport).not.toBeNull();

    // Scene fills the stage; dialogue overlays the bottom rather than sitting beside it.
    expect(Math.abs((sceneBox!.width ?? 0) - (stageBox!.width ?? 0))).toBeLessThan(4);
    expect(chatBox!.y).toBeGreaterThan((viewport!.height ?? 0) * 0.35);
    expect(chatBox!.x + chatBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  });

  test('no side-panel resizer remains', async ({ page }) => {
    await expect(page.locator('[role="separator"]')).toHaveCount(0);
  });
});
