const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const PACKAGED_PORT = 3210;
const DEV_PORT = 3000;
const READY_TIMEOUT_MS = 120_000;
const RETRY_MS = 500;

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

function bootLog(line) {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'm4trix-boot.log'), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // Logging must not prevent startup.
  }
}

function resolvePort(usePackagedServer) {
  if (process.env.M4TRIX_PORT) return Number(process.env.M4TRIX_PORT);
  return usePackagedServer ? PACKAGED_PORT : DEV_PORT;
}

function appUrl(port) {
  return process.env.M4TRIX_URL || `http://127.0.0.1:${port}`;
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function waitingPagePath() {
  return path.join(__dirname, 'waiting.html');
}

function setStatus(title, message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents
    .executeJavaScript(
      `window.__m4trixSetStatus && window.__m4trixSetStatus(${JSON.stringify(title)}, ${JSON.stringify(message)});`,
    )
    .catch(() => {});
}

function waitForUrl(url, timeoutMs = READY_TIMEOUT_MS) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(url);
      });
      req.on('error', () => {
        if (Date.now() - started >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tryOnce, RETRY_MS);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    tryOnce();
  });
}

function standaloneRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app-server')
    : path.join(app.getAppPath(), 'desktop-dist');
}

function startStandaloneServer(port) {
  const root = standaloneRoot();
  const serverJs = path.join(root, 'server.js');
  if (!fs.existsSync(serverJs)) {
    throw new Error(`Missing packaged server at ${serverJs}. Run: pnpm desktop:build`);
  }

  const pnpmNested = path.join(root, 'node_modules', '.pnpm', 'node_modules');
  bootLog(`spawn server root=${root} port=${port}`);
  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_PATH: [pnpmNested, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const log = (line) => bootLog(`server ${line}`);
  serverProcess.stdout?.on('data', (chunk) => log(String(chunk).trim()));
  serverProcess.stderr?.on('data', (chunk) => log(`ERR ${String(chunk).trim()}`));
  serverProcess.on('exit', (code, signal) => {
    log(`exited code=${code} signal=${signal}`);
    serverProcess = null;
  });
}

function stopStandaloneServer() {
  if (!serverProcess || serverProcess.killed) return;
  try {
    if (process.platform === 'win32' && serverProcess.pid) {
      spawn('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      serverProcess.kill('SIGTERM');
    }
  } catch {
    // The process may already have exited.
  }
  serverProcess = null;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: true,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadFile(waitingPagePath());
  const usePackagedServer = app.isPackaged || process.env.M4TRIX_USE_PACKAGED_SERVER === '1';
  const port = resolvePort(usePackagedServer);
  const url = appUrl(port);

  try {
    if (usePackagedServer) {
      setStatus('Starting m4trix…', 'Starting the bundled app server.');
      startStandaloneServer(port);
    } else {
      setStatus('Starting m4trix…', `Waiting for ${url}. Start Next with pnpm dev.`);
    }
    bootLog(`waiting for ${url}`);
    await waitForUrl(url);
    await mainWindow.loadURL(url);
    bootLog('ui loaded');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    bootLog(`startup failed: ${message}`);
    setStatus(
      'm4trix could not start',
      usePackagedServer
        ? `${message}. Rebuild with pnpm desktop:dist.`
        : `${message}. Start Next with pnpm dev.`,
    );
  }
}

function setupIpc() {
  ipcMain.handle('app-version', () => app.getVersion());
  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) return { status: 'dev' };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: 'checked', version: result?.updateInfo?.version ?? null };
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) };
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
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', { version: info.version });
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', { version: info.version });
  });
  autoUpdater.on('error', (error) => console.error('autoUpdater error', error));
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('checkForUpdatesAndNotify failed', error);
    });
  }, 2500);
}

async function bootstrap() {
  if (!app.requestSingleInstanceLock()) {
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
  bootLog('app ready');
  await createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  stopStandaloneServer();
});
app.on('window-all-closed', () => {
  stopStandaloneServer();
  if (process.platform !== 'darwin') app.quit();
});
bootstrap().catch((error) => {
  console.error('Failed to start m4trix desktop app', error);
  app.quit();
});
