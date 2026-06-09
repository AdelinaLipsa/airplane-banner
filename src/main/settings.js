'use strict';
const Store = require('electron-store');
const { safeStorage } = require('electron');

const DEFAULTS = {
  reminderOffsetsMinutes: [15, 5, 0],
  respectEventReminders: true,
  filters: {
    skipAllDay: true,
    skipDeclined: true,
    primaryCalendarOnly: true,
    requireAttendeesOrLink: true,
  },
  showTitle: true,
  theme: 'retro',
  sound: false,
  soundName: 'fanfare',
  soundVolume: 0.2,
  flightDurationSeconds: 12,
  suppressInFullscreen: true,
  suppressInDnd: true,
  clickableBanner: false,
  craft: 'tarom',          // which sprite tows the banner: tarom | ufo | rickroll | custom
  customCraftPath: '',     // absolute path to the user's own image/GIF when craft === 'custom'
  showCountdownInBar: true,
  flightScreen: 'cursor', // 'cursor' = display under the pointer; 'primary' = main display
  calendarColors: {},     // { [calendarId]: '#hex' } — optional per-calendar accent override
  launchAtLogin: true,
  pollIntervalMinutes: 5,
  snoozeUntilEpochMs: null,
  paused: false,
  activeHours: {
    enabled: false,
    startHour: 8,        // 24h local; window is [startHour, endHour)
    endHour: 19,
    days: [1, 2, 3, 4, 5], // 0=Sun … 6=Sat (default Mon–Fri)
  },
  accounts: [], // [{ id, email, calendars: [{ id, summary, primary, selected }] }]
  oauthClientId: '',
  oauthClientSecret: '',
};

const store = new Store({ defaults: DEFAULTS });

function getAll() { return store.store; }
function get(key) { return store.get(key); }
function set(key, value) { store.set(key, value); }

// --- Encrypted OAuth token storage ---------------------------------------
function saveTokens(tokens) {
  const json = JSON.stringify(tokens);
  if (safeStorage.isEncryptionAvailable()) {
    store.set('tokensEnc', safeStorage.encryptString(json).toString('base64'));
    store.delete('tokensPlain');
  } else {
    store.set('tokensPlain', json); // fallback (e.g. Linux without keyring)
  }
}
function loadTokens() {
  const enc = store.get('tokensEnc');
  if (enc && safeStorage.isEncryptionAvailable()) {
    try { return JSON.parse(safeStorage.decryptString(Buffer.from(enc, 'base64'))); }
    catch { return null; }
  }
  const plain = store.get('tokensPlain');
  return plain ? JSON.parse(plain) : null;
}
function clearTokens() { store.delete('tokensEnc'); store.delete('tokensPlain'); }

// --- Per-account encrypted token storage ----------------------------------
// Each account's tokens live under acctTokensEnc[id] (encrypted) or, when no
// keyring is available, acctTokensPlain[id]. Account metadata (id/email/
// calendars) lives in the non-secret `accounts` array.
function saveAccountTokens(id, tokens) {
  const json = JSON.stringify(tokens);
  if (safeStorage.isEncryptionAvailable()) {
    const map = store.get('acctTokensEnc') || {};
    map[id] = safeStorage.encryptString(json).toString('base64');
    store.set('acctTokensEnc', map);
  } else {
    const map = store.get('acctTokensPlain') || {};
    map[id] = json;
    store.set('acctTokensPlain', map);
  }
}
function loadAccountTokens(id) {
  const enc = store.get('acctTokensEnc') || {};
  if (enc[id] && safeStorage.isEncryptionAvailable()) {
    try { return JSON.parse(safeStorage.decryptString(Buffer.from(enc[id], 'base64'))); }
    catch { return null; }
  }
  const plain = store.get('acctTokensPlain') || {};
  return plain[id] ? JSON.parse(plain[id]) : null;
}
function deleteAccountTokens(id) {
  for (const key of ['acctTokensEnc', 'acctTokensPlain']) {
    const map = store.get(key);
    if (map && map[id] != null) { delete map[id]; store.set(key, map); }
  }
}

// One-time migration: an older single-account install kept tokens in tokensEnc/
// tokensPlain. Move them under a stable id and seed one account whose calendars
// hydrate on the next poll. Safe to call on every launch (no-ops once done).
function migrateLegacyAccount() {
  const accounts = store.get('accounts') || [];
  const legacy = loadTokens();
  if (!legacy || accounts.length) return;
  const id = '__migrated__';
  saveAccountTokens(id, legacy);
  store.set('accounts', [{ id, email: null, calendars: [] }]);
  clearTokens();
}

// --- Fired-reminder persistence (so restarts don't re-fly seen reminders) ---
const FIRED_TTL_MS = 24 * 60 * 60 * 1000; // forget entries older than a day

// Returns the still-relevant fired reminder keys, pruning anything stale.
function getFired() {
  const map = store.get('firedReminders') || {};
  const cutoff = Date.now() - FIRED_TTL_MS;
  const kept = {};
  for (const [key, firedAt] of Object.entries(map)) {
    if (firedAt > cutoff) kept[key] = firedAt;
  }
  store.set('firedReminders', kept);
  return Object.keys(kept);
}
function addFired(keys) {
  const map = store.get('firedReminders') || {};
  const now = Date.now();
  for (const key of keys) map[key] = now;
  store.set('firedReminders', map);
}
function clearFired() { store.set('firedReminders', {}); }

// --- Event cache ----------------------------------------------------------
// Persist the last fetched events so that, right after launch (before the first
// network poll completes), the scheduler can already arm imminent reminders —
// and so a brief offline window doesn't drop them. Only the few fields the
// scheduler needs are stored.
function saveEvents(events) {
  const slim = (events || []).map((e) => ({
    id: e.id, title: e.title, start: e.start, conferenceLink: e.conferenceLink || null,
    reminderOverrides: e.reminderOverrides || null, optOut: !!e.optOut,
  }));
  store.set('cachedEvents', slim);
}
// Return cached events that haven't started yet (older ones can't yield a
// future reminder). A small grace window keeps just-started meetings around.
function loadEvents() {
  const list = store.get('cachedEvents') || [];
  const cutoff = Date.now() - 60000;
  return list.filter((e) => Number.isFinite(e.start) && e.start > cutoff);
}

module.exports = {
  DEFAULTS, getAll, get, set, saveTokens, loadTokens, clearTokens,
  saveAccountTokens, loadAccountTokens, deleteAccountTokens, migrateLegacyAccount,
  getFired, addFired, clearFired, saveEvents, loadEvents,
};
