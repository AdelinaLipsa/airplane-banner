'use strict';
// Auto-update via electron-updater against GitHub Releases. Silent in the happy
// path: it checks on launch and every few hours, downloads in the background,
// and surfaces a tray status only when an update is ready to install on quit.
// A manual "Check for updates…" entry reports progress via a dialog.
const { app, dialog } = require('electron');

const SIX_HOURS = 6 * 60 * 60 * 1000;

let autoUpdater = null;
function loadUpdater() {
  if (autoUpdater !== null) return autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    try { autoUpdater.logger = require('electron-log'); autoUpdater.logger.transports.file.level = 'info'; } catch { /* logging optional */ }
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  } catch {
    autoUpdater = false; // dependency unavailable (e.g. dev without install)
  }
  return autoUpdater;
}

// Updates only make sense for a packaged, signed build pulling from Releases.
function canUpdate() {
  return app.isPackaged && !!loadUpdater();
}

let onStatus = () => {};
let timer = null;
let wired = false;

function wireOnce(au) {
  if (wired) return;
  wired = true;
  au.on('checking-for-update', () => onStatus(null));
  au.on('update-available', (info) => onStatus(`Downloading update ${info && info.version ? 'v' + info.version : ''}…`));
  au.on('update-not-available', () => onStatus(null));
  au.on('error', (err) => console.error('updater error:', err && err.message));
  au.on('update-downloaded', (info) => onStatus(`Update ${info && info.version ? 'v' + info.version : ''} ready — quit to install`));
}

// Start background auto-update. `statusCb(line|null)` lets the tray reflect state.
function start(statusCb) {
  if (typeof statusCb === 'function') onStatus = statusCb;
  if (!canUpdate()) return;
  const au = loadUpdater();
  wireOnce(au);
  const check = () => au.checkForUpdates().catch((e) => console.error('update check failed:', e && e.message));
  check();
  if (timer) clearInterval(timer);
  timer = setInterval(check, SIX_HOURS);
}

// Manual check from the tray; reports the outcome in a dialog.
async function checkNow() {
  const au = loadUpdater();
  if (!app.isPackaged || !au) {
    dialog.showMessageBox({ message: 'Updates are only available in the installed app.', buttons: ['OK'] });
    return;
  }
  wireOnce(au);
  try {
    const result = await au.checkForUpdates();
    const v = result && result.updateInfo && result.updateInfo.version;
    if (v && v !== app.getVersion()) {
      dialog.showMessageBox({ message: `Update v${v} is downloading. It will install when you quit.`, buttons: ['OK'] });
    } else {
      dialog.showMessageBox({ message: `You're up to date (v${app.getVersion()}).`, buttons: ['OK'] });
    }
  } catch (e) {
    // A 404 just means no release feed is published yet (e.g. a private repo or
    // before the first release) — show a calm, short message, never the raw
    // HTTP response (which includes headers/cookies).
    const msg = String((e && e.message) || '');
    const noReleases = /404|ENOTFOUND|cannot find/i.test(msg);
    dialog.showMessageBox({
      message: noReleases ? `You're on the latest version (v${app.getVersion()}).` : 'Could not check for updates.',
      detail: noReleases
        ? 'No newer release has been published yet.'
        : 'The update server couldn’t be reached. Please try again later.',
      buttons: ['OK'],
    });
  }
}

module.exports = { start, checkNow, canUpdate };
