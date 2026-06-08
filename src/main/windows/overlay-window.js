const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let win = null;
let pending = null;

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

// Move the overlay to whichever display the cursor is currently on, so the
// banner flies across the screen the user is actually looking at.
function positionOnActiveDisplay(w) {
  const point = screen.getCursorScreenPoint();
  const b = screen.getDisplayNearestPoint(point).bounds;
  w.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
}

function flyBanner(payload) {
  const w = win || build();
  if (w.webContents.isLoading()) {
    const alreadyQueued = pending !== null;
    pending = payload;
    if (!alreadyQueued) {
      w.webContents.once('did-finish-load', () => {
        const p = pending;
        pending = null;
        positionOnActiveDisplay(w);
        w.showInactive();
        w.webContents.send('fly', p);
      });
    }
    return;
  }
  positionOnActiveDisplay(w);
  w.showInactive();
  w.webContents.send('fly', payload);
}

ipcMain.on('flight-done', () => { if (win) win.hide(); });

module.exports = { flyBanner };
