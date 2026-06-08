'use strict';
const http = require('http');
const { URL } = require('url');
const { shell } = require('electron');
const { OAuth2Client } = require('google-auth-library');
const settings = require('../settings');
const accountsLib = require('../accounts');
const { listCalendars } = require('./client');
const embedded = require('../oauth-credentials');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// Prefer a per-user override from settings, otherwise the embedded app client.
function clientId() { return settings.get('oauthClientId') || embedded.clientId; }
function clientSecret() { return settings.get('oauthClientSecret') || embedded.clientSecret; }

// True when the app has OAuth credentials available (embedded or overridden).
function hasCredentials() { return !!(clientId() && clientSecret()); }

function makeClient(redirectUri) {
  return new OAuth2Client(clientId(), clientSecret(), redirectUri);
}

// An authorized client for a specific account id, or null if it has no tokens.
// Refreshed tokens are persisted back under the same account id.
function clientForAccount(id) {
  const tokens = settings.loadAccountTokens(id);
  if (!tokens) return null;
  const client = makeClient('http://127.0.0.1');
  client.setCredentials(tokens);
  client.on('tokens', (t) => {
    settings.saveAccountTokens(id, { ...settings.loadAccountTokens(id), ...t });
  });
  return client;
}

// All signed-in accounts paired with an authorized client.
function accountClients() {
  return (settings.get('accounts') || [])
    .map((account) => ({ account, client: clientForAccount(account.id) }))
    .filter((x) => x.client);
}

function hasValidAuth() {
  return (settings.get('accounts') || []).some((a) => settings.loadAccountTokens(a.id));
}

// After a successful OAuth exchange: discover the account's email + calendars
// and upsert it into settings (reusing an existing slot for the same email so
// re-auth refreshes instead of duplicating).
async function registerAccount(authedClient) {
  let calendars = [];
  try { calendars = await listCalendars(authedClient); } catch { /* keep empty; poll will hydrate */ }
  const email = (calendars.find((c) => c.primary) || {}).id || null;
  const accounts = settings.get('accounts') || [];
  const id = email ? accountsLib.resolveAccountId(accounts, email) : `acct-${accounts.length + 1}`;
  const existing = accounts.find((a) => a.id === id);
  const account = {
    id,
    email,
    calendars: accountsLib.mergeCalendars(existing ? existing.calendars : [], calendars),
  };
  settings.set('accounts', accountsLib.upsertById(accounts, account));
  return id;
}

// Opens the system browser, runs the loopback OAuth flow, then registers the
// resulting account (tokens stored per-account, calendars discovered).
function startAuthFlow() {
  return new Promise((resolve, reject) => {
    if (!hasCredentials()) {
      reject(new Error('This build has no Google OAuth client configured.'));
      return;
    }
    let timeout;
    const finish = (fn, arg) => { clearTimeout(timeout); try { server.close(); } catch {} fn(arg); };
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
        const authError = reqUrl.searchParams.get('error');
        if (authError) {
          res.end(`<html><body style="font-family:sans-serif">Sign-in canceled: ${authError}. You can close this tab.</body></html>`);
          finish(reject, new Error(`Authorization failed: ${authError}`));
          return;
        }
        const code = reqUrl.searchParams.get('code');
        if (!code) { res.end('Waiting for Google…'); return; }
        res.end('<html><body style="font-family:sans-serif">✅ Signed in. You can close this tab.</body></html>');
        const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
        client.setCredentials(tokens);
        // Discover the account (email + calendars) using the live client, then
        // persist its tokens under the resolved, stable account id.
        const realId = await registerAccount(client);
        settings.saveAccountTokens(realId, tokens);
        finish(resolve, realId);
      } catch (err) {
        try { res.end('Error: ' + err.message); } catch { /* response already sent */ }
        finish(reject, err);
      }
    });
    let port; let redirectUri; let client;
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      redirectUri = `http://127.0.0.1:${port}`;
      client = makeClient(redirectUri);
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
      });
      shell.openExternal(authUrl);
    });
    server.on('error', (err) => finish(reject, err));
    timeout = setTimeout(() => finish(reject, new Error('Sign-in timed out. Please try again.')), 5 * 60 * 1000);
  });
}

// Remove one account (tokens + metadata), or all of them.
function signOutAccount(id) {
  settings.deleteAccountTokens(id);
  settings.set('accounts', (settings.get('accounts') || []).filter((a) => a.id !== id));
}
function signOut() {
  for (const a of settings.get('accounts') || []) settings.deleteAccountTokens(a.id);
  settings.set('accounts', []);
}

module.exports = {
  clientForAccount, accountClients, registerAccount,
  hasValidAuth, hasCredentials, startAuthFlow, signOut, signOutAccount, SCOPES,
};
