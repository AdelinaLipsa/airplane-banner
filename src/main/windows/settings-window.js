const { BrowserWindow } = require('electron');
const path = require('path');

let win = null;

function openSettingsWindow() {
  if (win) { win.focus(); return win; }
  win = new BrowserWindow({
    width: 520, height: 640, title: 'Airplane Banner — Settings',
    resizable: false, minimizable: true, maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'settings', 'index.html'));
  win.on('closed', () => { win = null; });
  return win;
}

module.exports = { openSettingsWindow };
