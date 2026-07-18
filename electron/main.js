const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
const DEFAULT_DEV_URL = process.env.M4TRIX_DEV_URL || 'http://127.0.0.1:3000';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let nextProcess = null;
let nextPort = null;

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getStandaloneDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'next');
  }
  return path.join(__dirname, '..', '.next', 'standalone');
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(err => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForServer(url, attempts = 90) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return;
    } catch {
      // server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for Next.js server at ${url}`);
}

async function startNextServer() {
  const standaloneDir = getStandaloneDir();
  const serverJs = path.join(standaloneDir, 'server.js');
  nextPort = await findFreePort();

  nextProcess = spawn(process.execPath, [serverJs], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(nextPort),
      HOSTNAME: '127.0.0.1',
    },
    stdio: 'inherit',
  });

  nextProcess.on('exit', (code, signal) => {
    nextProcess = null;
    if (!app.isQuitting && code && code !== 0) {
      console.error(`Next.js server exited (code=${code}, signal=${signal})`);
    }
  });

  const url = `http://127.0.0.1:${nextPort}/`;
  await waitForServer(url);
  return url;
}

function stopNextServer() {
  if (!nextProcess || nextProcess.killed) return;
  try {
    nextProcess.kill();
  } catch (err) {
    console.error('Failed to stop Next.js server', err);
  }
  nextProcess = null;
}

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(startUrl);
}

function setupIpc() {
  ipcMain.handle('app-version', () => app.getVersion());

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { status: 'dev' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        status: 'checked',
        version: result?.updateInfo?.version ?? null,
      };
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.on('install-update', () => {
    app.isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', info => {
    mainWindow?.webContents.send('update-available', {
      version: info.version,
    });
  });

  autoUpdater.on('update-downloaded', info => {
    mainWindow?.webContents.send('update-downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', err => {
    console.error('autoUpdater error', err);
  });

  // Delay slightly so the window exists for IPC events.
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('checkForUpdatesAndNotify failed', err);
    });
  }, 2500);
}

async function bootstrap() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  setupIpc();

  await app.whenReady();

  const startUrl = isDev ? DEFAULT_DEV_URL : await startNextServer();
  createWindow(startUrl);
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void (async () => {
        const url = isDev ? DEFAULT_DEV_URL : `http://127.0.0.1:${nextPort}/`;
        createWindow(url);
      })();
    }
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  stopNextServer();
});

app.on('window-all-closed', () => {
  stopNextServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

bootstrap().catch(err => {
  console.error('Failed to start m4trix desktop app', err);
  app.quit();
});
