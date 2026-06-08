const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  onFly: (cb) => ipcRenderer.on('fly', (_e, payload) => cb(payload)),
  flightDone: () => ipcRenderer.send('flight-done'),
  setInteractive: (on) => ipcRenderer.send('overlay-interactive', on),
  openLink: (url) => ipcRenderer.send('overlay-open-link', url),
});
