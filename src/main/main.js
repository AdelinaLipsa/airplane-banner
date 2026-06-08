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
  onFly: (payload) => flyBanner({
    ...payload,
    showTitle: settings.get('showTitle'),
    theme: settings.get('theme'),
    sound: settings.get('sound'),
  }),
  loadFired: () => settings.getFired(),
  saveFired: (keys) => settings.addFired(keys),
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
ipcMain.handle('auth:signOut', () => { auth.signOut(); scheduler.clear(); settings.clearFired(); return true; });
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

// Poll fast (~1 min) when a meeting is imminent, otherwise at the configured
// interval — so an event created shortly before its start isn't missed.
function nextPollDelayMs(events) {
  const base = settings.get('pollIntervalMinutes') * 60000;
  if (events && events.length) {
    const soonest = events[0].start - Date.now();
    if (soonest < 10 * 60000) return Math.min(base, 60000);
  }
  return base;
}

function scheduleNextPoll(events) {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, nextPollDelayMs(events));
}

async function poll() {
  const client = auth.getOAuthClient();
  if (!client) { if (tray) tray.setStatus('Not signed in'); scheduleNextPoll(null); return; }
  try {
    const raw = await fetchUpcomingEvents(client, { hoursAhead: 4 });
    const events = filterEvents(normalizeEvents(raw, { calendarId: 'primary' }), settings.get('filters'))
      .filter((e) => Number.isFinite(e.start))
      .sort((a, b) => a.start - b.start);
    scheduler.update(events);
    if (tray) { tray.setNextStart(events.length ? events[0].start : null); tray.setStatus(nextMeetingLine(events)); }
    scheduleNextPoll(events);
  } catch (err) {
    if (tray) tray.setStatus('⚠ Calendar unavailable');
    console.error('poll failed:', err.message);
    scheduleNextPoll(null);
  }
}

function startPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  poll();
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  tray = createTray({
    onTestFlight: () => scheduler.testFly(),
    onTestSchedule: () => {
      // Inject a fake meeting so the smallest configured reminder fires in ~60s,
      // exercising the real schedule → timer → overlay path.
      const offsets = settings.get('reminderOffsetsMinutes') || [0];
      const minO = offsets.length ? Math.min(...offsets) : 0;
      const start = Date.now() + 60000 + minO * 60000;
      scheduler.update([{ id: '__test:' + Date.now(), title: 'Test Meeting', start }]);
    },
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
