const { contextBridge, ipcRenderer } = require("electron");

// expose a small API for renderer to use
contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, cb) => ipcRenderer.on(channel, (e, ...args) => cb(...args)),
});

// Detect failures to load client chunks or Next static assets (common in dev when
// the dev server rebuilds and the renderer still references old chunk filenames).
// When detected, reload the window to recover from stale assets.
(function installChunkReloadHandler() {
  try {
    window.addEventListener("error", (ev) => {
      try {
        const e = ev.error || ev;
        const msg = (e && e.message) || ev.message || "";
        const filename = (ev && ev.filename) || (e && e.filename) || "";
        if (
          msg.includes("Loading chunk") ||
          filename.includes("/_next/static/chunks/") ||
          msg.includes("chunk") && msg.includes("failed")
        ) {
          console.warn("Detected chunk/load error — reloading to recover.");
          location.reload();
        }
      } catch (err) {}
    });

    window.addEventListener("unhandledrejection", (ev) => {
      try {
        const reason = ev.reason || ev;
        const msg = (reason && reason.message) || String(reason || "");
        if (msg.includes("Loading chunk") || msg.includes("_next/static/chunks/")) {
          console.warn("Detected unhandled chunk rejection — reloading to recover.");
          location.reload();
        }
      } catch (err) {}
    });
  } catch (err) {}
})();
