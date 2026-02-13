 
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
/* eslint-disable no-console */
const fs = require("fs");
const { createRequire } = require("module");
function normalizeUrls(items) {
  if (!items) return [];
  const arr = Array.isArray(items) ? items : (items.items && Array.isArray(items.items) ? items.items : (items.urls && Array.isArray(items.urls) ? items.urls : []));
  const out = [];
  for (const it of arr) {
    if (!it) continue;
    if (typeof it === 'string') {
      out.push(it);
      continue;
    }
    if (typeof it === 'object') {
      const downloadUrl = typeof it.downloadUrl === 'string' ? it.downloadUrl : undefined;
      const baseUrl = typeof it.baseUrl === 'string' ? it.baseUrl : undefined;
      const urlArr = Array.isArray(it.url) ? it.url : undefined;
      if (downloadUrl && /^https?:\/\//.test(downloadUrl)) { out.push(downloadUrl); continue; }
      if (baseUrl && /^https?:\/\//.test(baseUrl)) { out.push(baseUrl); continue; }
      if (urlArr && urlArr.length) {
        const first = urlArr.find(u => typeof u === 'string' && /^https?:\/\//.test(u)) || urlArr[0];
        if (typeof first === 'string') { out.push(first); continue; }
      }
      const candidates = [
        it.src, it.imageUrl, it.href, it.link,
        (it.photo && it.photo.url), (it.media && it.media.url), (it.image && it.image.url)
      ];
      const found = candidates.find(u => typeof u === 'string' && /^https?:\/\//.test(u));
      if (found) { out.push(found); continue; }
      // shallow scan of string-valued props
      for (const k of Object.keys(it)) {
        const v = it[k];
        if (typeof v === 'string' && /^https?:\/\//.test(v)) { out.push(v); break; }
        if (v && typeof v === 'object' && typeof v.url === 'string' && /^https?:\/\//.test(v.url)) { out.push(v.url); break; }
      }
    }
  }
  return out;
}

const isDev = process.env.NODE_ENV !== "production";

// Ensure Windows uses the correct AppUserModelID so the taskbar groups and
// pinned shortcuts reference the right application identity and icon.
try {
  app.setAppUserModelId && app.setAppUserModelId('com.m4trix.app');
} catch (e) { /* ignore on platforms that don't support it */ }

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    // use the repository's red‑M icon for the window/taskbar (falls back if missing)
    icon: path.join(__dirname, '..', 'src', 'app', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // prefer explicit APP_URL if provided, otherwise use PORT env or default to 3000
  const initialPort = process.env.PORT || 3000;
  const preferredUrl = process.env.APP_URL || `http://localhost:${initialPort}`;
  let currentUrl = preferredUrl;

  win.loadURL(currentUrl).catch((err) => {
    console.warn("Initial loadURL failed:", err);
  });

  if (isDev) win.webContents.openDevTools({ mode: "detach" });

  // Force-close and re-open DevTools in dev so Chromium refreshes its window icon
  // (some Windows/Chromium combinations cache the DevTools window icon until the
  // DevTools window is recreated). This only runs in development.
  if (isDev && win.webContents.isDevToolsOpened()) {
    try {
      win.webContents.closeDevTools();
      setTimeout(() => {
        if (!win.isDestroyed()) win.webContents.openDevTools({ mode: 'detach' });
      }, 200);
    } catch (e) { /* ignore */ }
  }

  // If the renderer fails to load main-frame resources (404s for _next chunks),
  // clear the session cache and attempt to recover. If the dev server was
  // started on a different common port (eg. 3001) try that as a fallback.
  win.webContents.on("did-fail-load", async (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    try {
      if (!isMainFrame) return;
      console.warn("Main frame failed to load:", errorCode, errorDescription, validatedURL);
      const ses = win.webContents.session;
      try {
        await ses.clearCache();
      } catch (e) { /* ignore */ }

      // small delay to allow cache clear to settle
      setTimeout(() => {
        if (win.isDestroyed()) return;
        try {
          // If currentUrl looks like localhost:3000, try 3001 as a fallback
          if (currentUrl.includes("localhost") && currentUrl.includes(":3000")) {
            const fallback = currentUrl.replace(":3000", ":3001");
            console.warn(`Attempting fallback URL ${fallback}`);
            currentUrl = fallback;
            win.loadURL(currentUrl).catch((err) => {
              console.warn("Fallback loadURL failed, reloading instead:", err);
              if (!win.isDestroyed()) win.reload();
            });
            return;
          }
        } catch (e) { /* ignore */ }
        if (!win.isDestroyed()) win.reload();
      }, 50);
    } catch (e) { /* ignore */ }
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Google Photos album fetch IPC — runs in main (Node) to avoid CORS and bundling issues
let gpFetcher = null;
async function getGooglePhotosFetcher() {
  if (gpFetcher) return gpFetcher;
  try {
    // Try CommonJS first
    const cjs = require("google-photos-album-image-url-fetch");
    gpFetcher = cjs?.default || (typeof cjs === "function" ? cjs : null) ||
      cjs?.fetchAlbum || cjs?.fetchAlbumImageUrls || cjs?.getAlbumImageUrls || cjs?.getImageUrls || cjs?.getUrls || cjs?.fetchImageUrls;
    if (!gpFetcher && cjs && typeof cjs === 'object') {
      const anyFn = Object.values(cjs).find(v => typeof v === 'function');
      if (anyFn) gpFetcher = anyFn;
    }
  } catch (e) {
    // Fallback to dynamic import (ESM)
    try {
      const esm = await import("google-photos-album-image-url-fetch");
      gpFetcher = esm?.default || (typeof esm === "function" ? esm : null) ||
        esm?.fetchAlbum || esm?.fetchAlbumImageUrls || esm?.getAlbumImageUrls || esm?.getImageUrls || esm?.getUrls || esm?.fetchImageUrls;
      if (!gpFetcher && esm && typeof esm === 'object') {
        const anyFn = Object.values(esm).find(v => typeof v === 'function');
        if (anyFn) gpFetcher = anyFn;
      }
    } catch (e2) {
      gpFetcher = null;
    }
  }
  // If still not found, attempt to resolve from app root using createRequire
  if (!gpFetcher) {
    try {
      const appPath = app.getAppPath();
      const reqFromApp = createRequire(path.join(appPath, "package.json"));
      const mod = reqFromApp("google-photos-album-image-url-fetch");
      gpFetcher = mod?.default || (typeof mod === "function" ? mod : null) ||
        mod?.fetchAlbum || mod?.fetchAlbumImageUrls || mod?.getAlbumImageUrls || mod?.getImageUrls || mod?.getUrls || mod?.fetchImageUrls ||
        (mod && typeof mod === 'object' ? Object.values(mod).find(v => typeof v === 'function') : undefined);
    } catch (e) { /* ignore */ }
  }
  // Last-resort: scan pnpm virtual store for the package
  if (!gpFetcher) {
    try {
      const appPath = app.getAppPath();
      const pnpmDir = path.join(appPath, "node_modules", ".pnpm");
      if (fs.existsSync(pnpmDir)) {
        const entries = fs.readdirSync(pnpmDir);
        const hit = entries.find((n) => n.startsWith("google-photos-album-image-url-fetch@"));
        if (hit) {
          const pkgRoot = path.join(pnpmDir, hit, "node_modules", "google-photos-album-image-url-fetch");
          const reqLocal = createRequire(path.join(pkgRoot, "package.json"));
          const mod = reqLocal("google-photos-album-image-url-fetch");
          gpFetcher = mod?.default || (typeof mod === "function" ? mod : null) ||
            mod?.fetchAlbum || mod?.fetchAlbumImageUrls || mod?.getAlbumImageUrls || mod?.getImageUrls || mod?.getUrls || mod?.fetchImageUrls ||
            (mod && typeof mod === 'object' ? Object.values(mod).find(v => typeof v === 'function') : undefined);
        }
      }
    } catch (e) { /* ignore */ }
  }
  return gpFetcher;
}

ipcMain.handle("gp-fetch-album", async (_evt, albumUrl) => {
  const fn = await getGooglePhotosFetcher();
  if (!fn) throw new Error("google-photos-album-image-url-fetch not available in main");
  const raw = await fn(albumUrl);
  const urls = normalizeUrls(raw);
  try { console.log("[electron-main] gp-fetch-album result", { total: urls.length, sample: urls.slice(0, 5) }); } catch (e) { /* ignore */ }
  return urls;
});
