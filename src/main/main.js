const { app, ipcMain, powerMonitor } = require('electron');
const settings = require('./settings');
const { createTray } = require('./tray');
const { flyBanner } = require('./windows/overlay-window');
const { createScheduler } = require('./scheduler');
const { openSettingsWindow } = require('./windows/settings-window');
const auth = require('./calendar/auth');
const { fetchUpcomingEvents } = require('./calendar/client');
const { normalizeEvents } = require('./calendar/normalize');
const { filterEvents } = require('./calendar/filter');

// Transparent always-on-top overlay doesn't need GPU acceleration; disabling it
// silences noisy GPU-process logs and improves transparent-window reliability.
app.disableHardwareAcceleration();

let tray = null;

const scheduler = createScheduler({
  getState: () => ({
    offsetsMinutes: settings.get('reminderOffsetsMinutes'),
    paused: settings.get('paused'),
    snoozeUntilEpochMs: settings.get('snoozeUntilEpochMs'),
  }),
  onFly: (payload) => flyBanner({ ...payload, showTitle: settings.get('showTitle') }),
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
  if (auth.hasValidAuth()) startPolling();
  return settings.getAll();
});
ipcMain.handle('auth:signIn', async () => { await auth.startAuthFlow(); startPolling(); return true; });
ipcMain.handle('auth:signOut', () => { auth.signOut(); scheduler.clear(); return true; });
ipcMain.handle('auth:status', () => ({
  signedIn: auth.hasValidAuth(),
  hasCredentials: auth.hasCredentials(),
}));

let pollTimer = null;

function nextMeetingLine(events) {
  if (!events.length) return 'No meetings soon';
  const e = events[0];
  const mins = Math.max(0, Math.round((e.start - Date.now()) / 60000));
  const title = e.title.length > 40 ? e.title.slice(0, 39) + '…' : e.title;
  return `Next: ${title} in ${mins} min`;
}

async function poll() {
  const client = auth.getOAuthClient();
  if (!client) { if (tray) tray.setStatus('Not signed in'); return; }
  try {
    const raw = await fetchUpcomingEvents(client, { hoursAhead: 4 });
    const events = filterEvents(normalizeEvents(raw, { calendarId: 'primary' }), settings.get('filters'))
      .filter((e) => Number.isFinite(e.start))
      .sort((a, b) => a.start - b.start);
    scheduler.update(events);
    if (tray) tray.setStatus(nextMeetingLine(events));
  } catch (err) {
    if (tray) tray.setStatus('⚠ Calendar unavailable');
    console.error('poll failed:', err.message);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  poll();
  pollTimer = setInterval(poll, settings.get('pollIntervalMinutes') * 60000);
}

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
  startPolling();
  powerMonitor.on('resume', () => poll());
});

app.on('window-all-closed', () => { /* background app: stay alive */ });
