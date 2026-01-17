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

  const url = isDev ? "http://localhost:3000" : "http://localhost:3000";

  win.loadURL(url);
  if (isDev) win.webContents.openDevTools({ mode: "detach" });

  // If the renderer fails to load main-frame resources (404s for _next chunks),
  // clear the session cache and reload to recover from stale assets during dev.
  win.webContents.on("did-fail-load", async (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    try {
      if (isMainFrame) {
        console.warn("Main frame failed to load:", errorCode, errorDescription, validatedURL);
        const ses = win.webContents.session;
        try {
          await ses.clearCache();
        } catch (e) {}
        // small delay to allow cache clear to settle
        setTimeout(() => {
          if (!win.isDestroyed()) win.reload();
        }, 50);
      }
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
