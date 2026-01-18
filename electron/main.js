const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV !== "production";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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
      } catch (e) {}

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
        } catch (e) {}
        if (!win.isDestroyed()) win.reload();
      }, 50);
    } catch (e) {}
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
