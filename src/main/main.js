const { app, ipcMain } = require('electron');
const settings = require('./settings');
const { createTray } = require('./tray');
const { flyBanner } = require('./windows/overlay-window');
const { createScheduler } = require('./scheduler');
const { openSettingsWindow } = require('./windows/settings-window');
const auth = require('./calendar/auth');

let tray = null;

const scheduler = createScheduler({
  getState: () => ({
    offsetsMinutes: settings.get('reminderOffsetsMinutes'),
    paused: settings.get('paused'),
    snoozeUntilEpochMs: settings.get('snoozeUntilEpochMs'),
  }),
  onFly: (payload) => flyBanner(payload),
});

function openSettings() { openSettingsWindow(); }

function applyLaunchAtLogin() {
  app.setLoginItemSettings({ openAtLogin: settings.get('launchAtLogin'), openAsHidden: true });
}

ipcMain.handle('settings:load', () => settings.getAll());
ipcMain.handle('settings:save', (_e, patch) => {
  for (const [k, v] of Object.entries(patch)) settings.set(k, v);
  applyLaunchAtLogin();
  if (tray) tray.refresh();
  return settings.getAll();
});
ipcMain.handle('auth:signIn', async () => { await auth.startAuthFlow(); return true; });
ipcMain.handle('auth:signOut', () => { auth.signOut(); scheduler.clear(); return true; });
ipcMain.handle('auth:status', () => ({
  signedIn: auth.hasValidAuth(),
  hasCredentials: !!(settings.get('oauthClientId') && settings.get('oauthClientSecret')),
}));

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  tray = createTray({
    onTestFlight: () => scheduler.testFly(),
    onOpenSettings: openSettings,
    onQuit: () => app.quit(),
    onSnooze: (until) => { settings.set('snoozeUntilEpochMs', until); tray.refresh(); },
    onTogglePause: () => { settings.set('paused', !settings.get('paused')); tray.refresh(); },
  });
  tray.setStatus('No calendar connected');
  applyLaunchAtLogin();
});

app.on('window-all-closed', () => { /* background app: stay alive */ });
