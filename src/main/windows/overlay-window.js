const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let win = null;

function build() {
  const display = screen.getPrimaryDisplay();
  const b = display.bounds;
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, resizable: false, movable: false,
    minimizable: false, maximizable: false, skipTaskbar: true,
    focusable: false, hasShadow: false, alwaysOnTop: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'overlay', 'index.html'));
  win.on('closed', () => { win = null; });
  return win;
}

function flyBanner(payload) {
  const w = win || build();
  const send = () => { w.showInactive(); w.webContents.send('fly', payload); };
  if (w.webContents.isLoading()) {
    w.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

ipcMain.on('flight-done', () => { if (win) win.hide(); });

module.exports = { flyBanner };
