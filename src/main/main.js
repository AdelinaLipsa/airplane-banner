const { app, ipcMain, powerMonitor, shell } = require('electron');
const settings = require('./settings');
const { createTray } = require('./tray');
const { flyBanner } = require('./windows/overlay-window');
const { createScheduler } = require('./scheduler');
const { openSettingsWindow } = require('./windows/settings-window');
const presence = require('./presence');
const updater = require('./updater');
const accountsLib = require('./accounts');
const auth = require('./calendar/auth');
const { fetchUpcomingEvents, listCalendars } = require('./calendar/client');
const { normalizeEvents } = require('./calendar/normalize');
const { filterEvents } = require('./calendar/filter');

// Transparent always-on-top overlay doesn't need GPU acceleration; disabling it
// silences noisy GPU-process logs and improves transparent-window reliability.
app.disableHardwareAcceleration();

let tray = null;

const scheduler = createScheduler({
  getState: () => ({
    offsetsMinutes: settings.get('reminderOffsetsMinutes'),
    respectEventReminders: settings.get('respectEventReminders'),
    paused: settings.get('paused'),
    snoozeUntilEpochMs: settings.get('snoozeUntilEpochMs'),
    activeHours: settings.get('activeHours'),
  }),
  onFly: async (payload) => {
    // "Don't embarrass me": skip the flight entirely while presenting fullscreen
    // or with a Focus/DND active. Manual Test flights (payload.test) bypass this.
    if (!payload.test) {
      const prefs = {
        suppressInFullscreen: settings.get('suppressInFullscreen'),
        suppressInDnd: settings.get('suppressInDnd'),
      };
      if (prefs.suppressInFullscreen || prefs.suppressInDnd) {
        const states = await presence.detectPresence();
        if (presence.shouldSuppressForPresence(states, prefs)) return;
      }
    }
    const calColors = settings.get('calendarColors') || {};
    flyBanner({
      ...payload,
      showTitle: settings.get('showTitle'),
      theme: settings.get('theme'),
      accent: payload.calendarId ? calColors[payload.calendarId] : undefined,
      sound: settings.get('sound'),
      soundName: settings.get('soundName'),
      soundVolume: settings.get('soundVolume'),
      durationSeconds: settings.get('flightDurationSeconds'),
      clickable: settings.get('clickableBanner'),
      flightScreen: settings.get('flightScreen'),
    });
  },
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
  updateBarTitle();
  if (auth.hasValidAuth()) startPolling();
  return settings.getAll();
});
// Preview flight from the Settings "Test flight" button, using the values
// currently in the form (even before Save). test:true bypasses the usual
// fullscreen/DND suppression so the preview always shows.
ipcMain.handle('settings:test-flight', (_e, a = {}) => {
  flyBanner({
    minutes: 10,
    title: 'Test flight',
    test: true,
    showTitle: a.showTitle !== false,
    theme: a.theme,
    sound: !!a.sound,
    soundName: a.soundName,
    soundVolume: a.soundVolume,
    durationSeconds: a.flightDurationSeconds,
    clickable: false,
    flightScreen: settings.get('flightScreen'),
  });
  return true;
});

ipcMain.handle('auth:signIn', async () => { await auth.startAuthFlow(); startPolling(); return true; });
ipcMain.handle('auth:signOut', () => { auth.signOut(); scheduler.clear(); settings.clearFired(); return true; });
ipcMain.handle('auth:signOutAccount', (_e, id) => {
  auth.signOutAccount(id);
  if (!auth.hasValidAuth()) { scheduler.clear(); settings.clearFired(); }
  if (auth.hasValidAuth()) startPolling();
  return true;
});
ipcMain.handle('accounts:toggleCalendar', (_e, { accountId, calendarId, selected }) => {
  const accounts = (settings.get('accounts') || []).map((a) => (a.id !== accountId ? a : {
    ...a, calendars: (a.calendars || []).map((c) => (c.id === calendarId ? { ...c, selected } : c)),
  }));
  settings.set('accounts', accounts);
  if (auth.hasValidAuth()) startPolling();
  return true;
});
ipcMain.handle('auth:status', () => ({
  signedIn: auth.hasValidAuth(),
  hasCredentials: auth.hasCredentials(),
  // Account metadata only (no tokens) for the Settings calendar pickers.
  accounts: (settings.get('accounts') || []).map((a) => ({ id: a.id, email: a.email, calendars: a.calendars || [] })),
}));

let pollTimer = null;
let barTimer = null;
let nextStartMs = null; // start of the next meeting, for the live menu-bar countdown

// Refresh the menu-bar title from current state. Paused/snoozed take precedence
// over the countdown (a glyph beats a number you can't act on); otherwise show
// the live time to the next meeting. Called on each poll and once a minute in
// between so the number ticks down on its own. Honors the user's toggle.
function updateBarTitle() {
  if (!tray) return;
  if (!settings.get('showCountdownInBar')) { tray.setTitle(''); return; }
  if (settings.get('paused')) { tray.setTitle('⏸'); return; }
  const snoozeUntil = settings.get('snoozeUntilEpochMs');
  if (snoozeUntil && snoozeUntil > Date.now()) { tray.setTitle('💤'); return; }
  if (!nextStartMs || nextStartMs <= Date.now()) { tray.setTitle(''); return; }
  const mins = Math.max(0, Math.round((nextStartMs - Date.now()) / 60000));
  tray.setTitle(fmtBar(mins));
}

// Humanize a minute count: "5 min", "1h 20m", "3h". Hours kick in at 60+ so a
// meeting hours away doesn't read as "in 200 min".
function fmtUntil(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Compact form for the menu-bar title next to the icon, where space is tight:
// "5m", "1h20m", "3h". Empty when nothing is coming up.
function fmtBar(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

function nextMeetingLine(events) {
  if (!events.length) return 'No meetings soon';
  const e = events[0];
  const mins = Math.max(0, Math.round((e.start - Date.now()) / 60000));
  const title = e.title.length > 40 ? e.title.slice(0, 39) + '…' : e.title;
  return `Next: ${title} in ${fmtUntil(mins)}`;
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

function endOfLocalDay() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// Pull events from every selected calendar of every signed-in account, lazily
// hydrating an account's calendar list/email on first sight. Returns the merged,
// account-namespaced, normalized events (unfiltered, unsorted).
async function fetchAllAccounts(clients, hoursAhead) {
  let meta = settings.get('accounts') || [];
  let metaChanged = false;
  const out = [];
  for (const { account, client } of clients) {
    let calendars = account.calendars;
    if (!calendars || !calendars.length) {
      try {
        const fetched = await listCalendars(client);
        const email = (fetched.find((c) => c.primary) || {}).id || account.email;
        calendars = accountsLib.mergeCalendars([], fetched);
        meta = meta.map((a) => (a.id === account.id ? { ...a, email, calendars } : a));
        metaChanged = true;
      } catch (e) { console.error('calendar list failed:', e.message); }
    }
    for (const cal of accountsLib.selectedCalendars({ calendars })) {
      try {
        const raw = await fetchUpcomingEvents(client, { hoursAhead, calendarId: cal.id });
        for (const ev of normalizeEvents(raw, { calendarId: cal.id })) {
          out.push({ ...ev, id: accountsLib.namespaceId(account.id, ev.id) });
        }
      } catch (e) { console.error(`fetch ${cal.id} failed:`, e.message); }
    }
  }
  if (metaChanged) settings.set('accounts', meta);
  return out;
}

// Drop duplicates of the same meeting that appear on more than one selected
// calendar/account (same title + start), so it only flies once.
function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.title}|${e.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function poll() {
  const clients = auth.accountClients();
  if (!clients.length) { if (tray) tray.setStatus('Not signed in'); nextStartMs = null; updateBarTitle(); scheduleNextPoll(null); return; }
  try {
    // Fetch at least 4h out, but always through end of today so the tray agenda
    // shows every remaining meeting (not just those in the next few hours).
    const hoursAhead = Math.max(4, (endOfLocalDay() - Date.now()) / 3600000 + 0.02);
    const raw = await fetchAllAccounts(clients, hoursAhead);
    // Calendar selection already governs inclusion, so don't also drop by
    // primary-only here; the other meeting filters still apply.
    const events = dedupeEvents(
      filterEvents(raw, { ...settings.get('filters'), primaryCalendarOnly: false }),
    )
      .filter((e) => Number.isFinite(e.start))
      .sort((a, b) => a.start - b.start);
    scheduler.update(events);
    settings.saveEvents(events); // so reminders are pre-armed on next launch
    const agenda = events.filter((e) => e.start <= endOfLocalDay());
    if (tray) {
      tray.setNextStart(events.length ? events[0].start : null);
      tray.setAgenda(agenda);
      tray.setStatus(nextMeetingLine(events));
    }
    nextStartMs = events.length ? events[0].start : null;
    updateBarTitle();
    scheduleNextPoll(events);
  } catch (err) {
    if (tray) tray.setStatus('⚠ Calendar unavailable');
    console.error('poll failed:', err.message);
    scheduleNextPoll(null);
  }
}

function startPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  if (barTimer) clearInterval(barTimer);
  barTimer = setInterval(updateBarTitle, 60000); // tick the bar countdown between polls
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
    onSnooze: (until) => { settings.set('snoozeUntilEpochMs', until); tray.refresh(); updateBarTitle(); },
    onTogglePause: () => { settings.set('paused', !settings.get('paused')); tray.refresh(); updateBarTitle(); },
    onOpenLink: (url) => { if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url); },
    onCheckForUpdates: () => updater.checkNow(),
    canUpdate: updater.canUpdate(),
  });
  tray.setStatus('No calendar connected');
  settings.migrateLegacyAccount(); // move a pre-multi-account install's tokens
  applyLaunchAtLogin();
  // Arm reminders from the last cached events immediately, so a meeting that's
  // due in the seconds-to-minutes before the first poll returns isn't missed.
  const cached = settings.loadEvents();
  if (cached.length) {
    scheduler.update(cached);
    tray.setNextStart(cached[0].start);
    tray.setAgenda(cached.filter((e) => e.start <= endOfLocalDay()));
  }
  startPolling();
  // Background auto-update; reflect download/ready state in the tray status.
  updater.start((line) => { if (line && tray) tray.setStatus(line); });
  powerMonitor.on('resume', () => poll());

  // CI smoke test: having reached this point, the app booted (tray, settings,
  // scheduler, updater) without throwing — exit cleanly so the run can pass.
  if (process.env.SMOKE_TEST) setTimeout(() => app.exit(0), 1200);
});

app.on('window-all-closed', () => { /* background app: stay alive */ });
