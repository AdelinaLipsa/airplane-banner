'use strict';
// A small always-on-top "next meeting" pill that floats at the bottom-right,
// just above the taskbar. The elegant Windows alternative to text beside the
// tray icon (which Windows doesn't support). Frameless + transparent + never
// steals focus; clicking it joins the meeting or opens the tray menu.
const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let win = null;
const W = 240;
const H = 48;

function build() {
  win = new BrowserWindow({
    width: W, height: H,
    frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'note-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'note', 'index.html'));
  win.on('closed', () => { win = null; });
  return win;
}

// Pin to the bottom-right of the primary display's work area (which excludes the
// taskbar), so the pill sits just above it.
function position(w) {
  const wa = screen.getPrimaryDisplay().workArea;
  w.setBounds({ x: wa.x + wa.width - W - 12, y: wa.y + wa.height - H - 8, width: W, height: H });
}

function createNoteWindow({ onClick }) {
  ipcMain.on('note-click', () => { if (onClick) onClick(); });
  return {
    show(text) {
      const w = win || build();
      const paint = () => { position(w); w.showInactive(); w.webContents.send('note-text', text); };
      if (w.webContents.isLoading()) w.webContents.once('did-finish-load', paint);
      else paint();
    },
    hide() { if (win && win.isVisible()) win.hide(); },
  };
}

module.exports = { createNoteWindow };
