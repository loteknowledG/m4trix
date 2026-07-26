const { app, BrowserWindow, ipcMain } = require('electron');

const UPDATE_FEED_URL =
  'https://github.com/loteknowledG/m4trix/releases/latest/download';

/** @type {string | null} */
let downloadedVersion = null;

/** @type {import('electron-updater').AppUpdater | null} */
let autoUpdater = null;

function loadAutoUpdater() {
  if (autoUpdater) return autoUpdater;
  try {
    // Prefer a vendored copy shipped inside the asar for packaged builds.
    autoUpdater = require('./vendor/electron-updater').autoUpdater;
    return autoUpdater;
  } catch {
    // fall through
  }
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    return autoUpdater;
  } catch (error) {
    console.error('[m4trix] electron-updater unavailable:', error);
    return null;
  }
}

function broadcastUpdateEvent(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send('m4trix:app-update:event', payload);
  }
}

function compareVersions(left, right) {
  const a = String(left || '0.0.0')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right || '0.0.0')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function formatCheckResult(latestVersion, downloaded) {
  const running = app.getVersion();
  const latest = latestVersion || running;
  if (downloaded || compareVersions(latest, running) > 0) {
    return { status: 'update-available', running, latest, downloaded: Boolean(downloaded) };
  }
  return { status: 'up-to-date', running, latest: running, downloaded: false };
}

function registerFallbackAutoUpdateHandlers(message) {
  ipcMain.handle('m4trix:app-update:get-version', async () => app.getVersion());

  ipcMain.handle('m4trix:app-update:check', async () => ({
    status: 'unavailable',
    message:
      message ||
      'Auto-update is unavailable in this build. Rebuild with pnpm desktop:dist.',
  }));

  ipcMain.handle('m4trix:app-update:quit-and-install', async () => ({
    ok: false,
    error: 'No update runtime is available in this build.',
  }));
}

function registerDevAutoUpdateHandlers() {
  ipcMain.handle('m4trix:app-update:get-version', async () => app.getVersion());

  ipcMain.handle('m4trix:app-update:check', async () => ({
    status: 'local-dev',
    message: 'Auto-update runs in installed desktop builds. Dev mode uses pnpm electron:dev.',
  }));

  ipcMain.handle('m4trix:app-update:quit-and-install', async () => ({
    ok: false,
    error: 'No downloaded update is ready to install in dev mode.',
  }));
}

function initializeAutoUpdater() {
  if (!app.isPackaged) {
    registerDevAutoUpdateHandlers();
    return;
  }

  const updater = loadAutoUpdater();
  if (!updater) {
    registerFallbackAutoUpdateHandlers(
      'electron-updater is missing from this install. Rebuild with pnpm desktop:dist.',
    );
    return;
  }

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.allowDowngrade = false;
  updater.disableWebInstaller = true;

  updater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEED_URL,
  });

  updater.on('update-available', (info) => {
    broadcastUpdateEvent({ type: 'update-available', version: info.version });
  });

  updater.on('download-progress', (progress) => {
    broadcastUpdateEvent({
      type: 'download-progress',
      percent: progress.percent,
      version: downloadedVersion,
    });
  });

  updater.on('update-downloaded', (info) => {
    downloadedVersion = info.version;
    broadcastUpdateEvent({ type: 'update-downloaded', version: info.version });
  });

  updater.on('error', (error) => {
    broadcastUpdateEvent({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  });

  ipcMain.handle('m4trix:app-update:get-version', async () => app.getVersion());

  ipcMain.handle('m4trix:app-update:check', async () => {
    try {
      const result = await updater.checkForUpdates();
      const latest = result?.updateInfo?.version ?? app.getVersion();
      return formatCheckResult(latest, downloadedVersion === latest);
    } catch (error) {
      return {
        status: 'unavailable',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('m4trix:app-update:quit-and-install', async () => {
    if (downloadedVersion) {
      app.isQuitting = true;
      updater.quitAndInstall(false, true);
      return { ok: true };
    }
    return { ok: false, error: 'No downloaded update is ready to install.' };
  });

  const runBackgroundCheck = () => {
    void updater.checkForUpdates().catch(() => {
      /* surfaced via update:error event */
    });
  };

  // Delay first check so the UI can finish loading, then poll periodically.
  setTimeout(runBackgroundCheck, 12_000);
  setInterval(runBackgroundCheck, 4 * 60 * 60 * 1000);
}

module.exports = {
  initializeAutoUpdater,
};
