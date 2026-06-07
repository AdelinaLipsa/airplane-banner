const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (patch) => ipcRenderer.invoke('settings:save', patch),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  authStatus: () => ipcRenderer.invoke('auth:status'),
});
