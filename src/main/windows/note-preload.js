const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noteApi', {
  onText: (cb) => ipcRenderer.on('note-text', (_e, t) => cb(t)),
  click: () => ipcRenderer.send('note-click'),
});
