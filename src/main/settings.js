'use strict';
const Store = require('electron-store');
const { safeStorage } = require('electron');

const DEFAULTS = {
  reminderOffsetsMinutes: [15, 5, 0],
  filters: {
    skipAllDay: true,
    skipDeclined: true,
    primaryCalendarOnly: true,
    requireAttendeesOrLink: true,
  },
  showTitle: true,
  theme: 'retro',
  sound: false,
  flightDurationSeconds: 12,
  clickableBanner: false,
  launchAtLogin: true,
  pollIntervalMinutes: 5,
  snoozeUntilEpochMs: null,
  paused: false,
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

module.exports = {
  DEFAULTS, getAll, get, set, saveTokens, loadTokens, clearTokens,
  getFired, addFired, clearFired,
};
