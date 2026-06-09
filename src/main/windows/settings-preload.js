const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  platform: process.platform,
  load: () => ipcRenderer.invoke('settings:load'),
  save: (patch) => ipcRenderer.invoke('settings:save', patch),
  testFlight: (appearance) => ipcRenderer.invoke('settings:test-flight', appearance),
  pickCraftFile: () => ipcRenderer.invoke('settings:pick-craft-file'),
  saveCraft: (dataUrl) => ipcRenderer.invoke('settings:save-craft', dataUrl),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  signOutAccount: (id) => ipcRenderer.invoke('auth:signOutAccount', id),
  toggleCalendar: (accountId, calendarId, selected) =>
    ipcRenderer.invoke('accounts:toggleCalendar', { accountId, calendarId, selected }),
  authStatus: () => ipcRenderer.invoke('auth:status'),
});
