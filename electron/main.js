const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

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
    fs.appendFileSync(
      path.join(dir, 'm4trix-boot.log'),
      `[${new Date().toISOString()}] ${line}\n`,
    );
  } catch {
    // ignore
  }
}

function resolvePort(usePackagedServer) {
  if (process.env.M4TRIX_PORT) return Number(process.env.M4TRIX_PORT);
  return usePackagedServer ? PACKAGED_PORT : DEV_PORT;
}

function appUrl(port) {
  return process.env.M4TRIX_URL || `http://127.0.0.1:${port}`;
}

function waitingPagePath() {
  return path.join(__dirname, 'waiting.html');
}

function setStatus(title, message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const safeTitle = JSON.stringify(title);
  const safeMessage = JSON.stringify(message);
  mainWindow.webContents
    .executeJavaScript(
      `window.__m4trixSetStatus && window.__m4trixSetStatus(${safeTitle}, ${safeMessage});`,
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

      req.setTimeout(1500, () => {
        req.destroy();
      });
    };

    tryOnce();
  });
}

function standaloneRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app-server');
  }
  return path.join(app.getAppPath(), 'desktop-dist');
}

function startStandaloneServer(port) {
  const root = standaloneRoot();
  const serverJs = path.join(root, 'server.js');

  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Missing packaged server at ${serverJs}. Run: pnpm desktop:build`,
    );
  }

  const pnpmNested = path.join(root, 'node_modules', '.pnpm', 'node_modules');
  bootLog(`spawn server root=${root} port=${port}`);

  // Reuse the Electron binary as Node so we do not ship a second runtime.
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

  const logPath = path.join(app.getPath('userData'), 'm4trix-server.log');
  const log = (line) => {
    try {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
    } catch {
      // ignore
    }
  };

  serverProcess.stdout?.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    console.log(`[m4trix-server] ${text}`);
    log(text);
  });
  serverProcess.stderr?.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    console.error(`[m4trix-server] ${text}`);
    log(`ERR ${text}`);
  });
  serverProcess.on('exit', (code, signal) => {
    const msg = `exited code=${code} signal=${signal}`;
    console.error(`[m4trix-server] ${msg}`);
    log(msg);
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
    // ignore
  }
  serverProcess = null;
}

async function createWindow() {
  bootLog(`createWindow packaged=${app.isPackaged}`);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await mainWindow.loadFile(waitingPagePath());

  const usePackagedServer =
    app.isPackaged || process.env.M4TRIX_USE_PACKAGED_SERVER === '1';
  const port = resolvePort(usePackagedServer);
  const url = appUrl(port);

  try {
    if (usePackagedServer) {
      setStatus('Starting m4trix…', 'Starting the bundled app server.');
      startStandaloneServer(port);
    } else {
      setStatus(
        'Starting m4trix…',
        `Waiting for ${url}. For daily work use pnpm dev, or run pnpm electron:dev.`,
      );
    }

    bootLog(`waiting for ${url}`);
    await waitForUrl(url);
    bootLog(`loading ${url}`);
    await mainWindow.loadURL(url);
    bootLog('ui loaded');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bootLog(`startup failed: ${message}`);
    setStatus(
      'm4trix could not start',
      usePackagedServer
        ? `${message}. Rebuild with pnpm desktop:dist.`
        : `${message}. Start Next with pnpm dev, or use the packaged build via pnpm desktop:dist.`,
    );
  }
}

app.whenReady().then(() => {
  bootLog('app ready');
  return createWindow();
});

app.on('before-quit', () => {
  stopStandaloneServer();
});

app.on('window-all-closed', () => {
  stopStandaloneServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
