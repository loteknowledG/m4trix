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
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
