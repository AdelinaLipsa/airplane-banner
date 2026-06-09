const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noteApi', {
  onText: (cb) => ipcRenderer.on('note-text', (_e, t) => cb(t)),
  onTheme: (cb) => ipcRenderer.on('note-theme', (_e, p) => cb(p)),
  click: () => ipcRenderer.send('note-click'),
});
