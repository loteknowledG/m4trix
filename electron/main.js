const { app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { initializeAutoUpdater } = require('./auto-updater');

const PACKAGED_PORT = 3210;
const DEV_PORT = 3000;
// USB / cold starts of the packaged Next server can take several minutes.
const READY_TIMEOUT_MS = 5 * 60_000;
const RETRY_MS = 750;

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

function probeUrl(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForUrl(url, timeoutMs = READY_TIMEOUT_MS, onProgress) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    let inFlight = false;

    const fail = (message) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve(url);
    };

    const schedule = (delay = RETRY_MS) => {
      if (settled) return;
      setTimeout(tryOnce, delay);
    };

    const tryOnce = () => {
      if (settled || inFlight) return;
      inFlight = true;
      const elapsedSec = Math.round((Date.now() - started) / 1000);
      try {
        onProgress?.(elapsedSec);
      } catch {
        // ignore progress errors
      }

      const req = http.get(url, (res) => {
        inFlight = false;
        res.resume();
        succeed();
      });

      const retryOrTimeout = () => {
        inFlight = false;
        if (settled) return;
        if (Date.now() - started >= timeoutMs) {
          fail(`Timed out waiting for ${url} after ${Math.round(timeoutMs / 1000)}s`);
          return;
        }
        schedule();
      };

      req.on('error', retryOrTimeout);
      req.setTimeout(2000, () => {
        req.destroy();
        retryOrTimeout();
      });
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

function readRecentBootLines(limit = 12) {
  try {
    const logPath = path.join(app.getPath('userData'), 'm4trix-boot.log');
    if (!fs.existsSync(logPath)) return '';
    const lines = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/);
    return lines.slice(-limit).join('\n');
  } catch {
    return '';
  }
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
    const alreadyUp = await probeUrl(url);
    if (usePackagedServer && !alreadyUp) {
      setStatus('Starting m4trix…', 'Starting the bundled app server (first launch can be slow).');
      startStandaloneServer(port);
    } else if (!usePackagedServer) {
      setStatus('Starting m4trix…', `Waiting for ${url}. Start Next with pnpm dev.`);
    } else {
      bootLog(`reusing existing server at ${url}`);
      setStatus('Starting m4trix…', 'Connecting to local app server…');
    }

    bootLog(`waiting for ${url}`);
    await waitForUrl(url, READY_TIMEOUT_MS, (elapsedSec) => {
      if (elapsedSec < 3) return;
      setStatus(
        'Starting m4trix…',
        usePackagedServer
          ? `Still starting bundled server… ${elapsedSec}s`
          : `Waiting for ${url}… ${elapsedSec}s`,
      );
    });
    await mainWindow.loadURL(url);
    bootLog('ui loaded');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const recent = readRecentBootLines();
    bootLog(`startup failed: ${message}`);
    if (recent) bootLog(`recent boot log:\n${recent}`);
    setStatus(
      'm4trix could not start',
      usePackagedServer
        ? `${message}. If this install is on a USB drive, try again or move it to an internal disk. Or run pnpm electron:dev / rebuild with pnpm desktop:dist.`
        : `${message}. Start Next with pnpm dev.`,
    );
  }
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
  await app.whenReady();
  bootLog('app ready');
  await createWindow();
  initializeAutoUpdater();
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
