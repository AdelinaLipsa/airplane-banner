const { BrowserWindow, screen, ipcMain, shell } = require('electron');
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
      autoplayPolicy: 'no-user-gesture-required', // let the flight chime / Rick Roll clip play
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

// Position the overlay before each flight. 'primary' pins it to the main
// display; 'cursor' (default) follows the pointer so the banner flies across
// the screen the user is actually looking at.
function positionForFlight(w, mode) {
  const b = mode === 'primary'
    ? screen.getPrimaryDisplay().bounds
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds;
  w.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
}

function showFlight(w, p) {
  // Forward mouse-move only when the banner is meant to be clickable, so the
  // renderer can make just the banner interactive; otherwise stay click-through.
  const forward = !!(p.clickable && p.link);
  w.setIgnoreMouseEvents(true, { forward });
  positionForFlight(w, p.flightScreen);
  w.showInactive();
  w.webContents.send('fly', p);
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
        showFlight(w, p);
      });
    }
    return;
  }
  showFlight(w, payload);
}

ipcMain.on('flight-done', () => {
  if (win) { win.setIgnoreMouseEvents(true, { forward: true }); win.hide(); }
});

// Click-to-join (opt-in): the renderer forwards hover so only the banner is
// interactive; everything else stays click-through.
ipcMain.on('overlay-interactive', (_e, interactive) => {
  if (win) win.setIgnoreMouseEvents(!interactive, { forward: true });
});
ipcMain.on('overlay-open-link', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
  if (win) { win.setIgnoreMouseEvents(true, { forward: true }); win.hide(); }
});

module.exports = { flyBanner };
