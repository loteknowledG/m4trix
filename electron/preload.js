const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('m4trixDesktop', {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('m4trix:app-update:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('m4trix:app-update:check'),
  quitAndInstall: () => ipcRenderer.invoke('m4trix:app-update:quit-and-install'),
  // Back-compat alias used by older renderer code.
  installUpdate: () => {
    void ipcRenderer.invoke('m4trix:app-update:quit-and-install');
  },
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('m4trix:app-update:event', listener);
    return () => ipcRenderer.removeListener('m4trix:app-update:event', listener);
  },
  onUpdateAvailable: (callback) => {
    const handler = (_event, payload) => {
      if (payload?.type === 'update-available') callback({ version: payload.version });
    };
    ipcRenderer.on('m4trix:app-update:event', handler);
    return () => ipcRenderer.removeListener('m4trix:app-update:event', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, payload) => {
      if (payload?.type === 'update-downloaded') callback({ version: payload.version });
    };
    ipcRenderer.on('m4trix:app-update:event', handler);
    return () => ipcRenderer.removeListener('m4trix:app-update:event', handler);
  },
  autoClickEmbedPlay: (bounds) => ipcRenderer.invoke('m4trix:embed:auto-click-play', bounds),
});
