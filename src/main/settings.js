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

module.exports = { DEFAULTS, getAll, get, set, saveTokens, loadTokens, clearTokens };
