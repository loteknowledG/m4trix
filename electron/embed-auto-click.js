const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_SCREENSHOTS = 20;

function bootLog(line) {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'm4trix-boot.log'), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // Logging must not prevent playback.
  }
}

function trimScreenshotDir(dir) {
  try {
    const files = fs
      .readdirSync(dir)
      .filter(name => name.startsWith('embed-play-') && name.endsWith('.png'))
      .map(name => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const stale of files.slice(MAX_SCREENSHOTS)) {
      fs.unlinkSync(path.join(dir, stale.name));
    }
  } catch {
    // Best-effort cleanup.
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture the embed player region, then click once at its center.
 * Screenshots are saved under userData/embed-clicks for debugging.
 *
 * @param {import('electron').WebContents} webContents
 * @param {{ x: number; y: number; width: number; height: number }} bounds
 */
async function autoClickEmbedPlay(webContents, bounds) {
  const x = Math.max(0, Math.round(bounds.x));
  const y = Math.max(0, Math.round(bounds.y));
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const clickX = Math.round(x + width / 2);
  const clickY = Math.round(y + height / 2);

  let screenshotPath = null;
  try {
    const image = await webContents.capturePage({ x, y, width, height });
    const dir = path.join(app.getPath('userData'), 'embed-clicks');
    fs.mkdirSync(dir, { recursive: true });
    screenshotPath = path.join(dir, `embed-play-${Date.now()}.png`);
    fs.writeFileSync(screenshotPath, image.toPNG());
    trimScreenshotDir(dir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    bootLog(`embed-auto-click: screenshot failed (${message})`);
  }

  try {
    webContents.focus();
  } catch {
    // Continue even if focus fails.
  }

  await sleep(40);
  webContents.sendInputEvent({ type: 'mouseMove', x: clickX, y: clickY });
  await sleep(16);
  webContents.sendInputEvent({
    type: 'mouseDown',
    x: clickX,
    y: clickY,
    button: 'left',
    clickCount: 1,
  });
  await sleep(16);
  webContents.sendInputEvent({
    type: 'mouseUp',
    x: clickX,
    y: clickY,
    button: 'left',
    clickCount: 1,
  });

  bootLog(
    `embed-auto-click: clicked (${clickX},${clickY}) region ${width}x${height}` +
      (screenshotPath ? ` screenshot=${screenshotPath}` : ''),
  );

  return {
    ok: true,
    click: { x: clickX, y: clickY },
    screenshotPath,
  };
}

module.exports = { autoClickEmbedPlay };
