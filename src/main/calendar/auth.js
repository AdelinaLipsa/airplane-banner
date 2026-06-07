'use strict';
const http = require('http');
const { URL } = require('url');
const { shell } = require('electron');
const { OAuth2Client } = require('google-auth-library');
const settings = require('../settings');
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

// Returns an authorized client using stored tokens, or null if not signed in.
function getOAuthClient() {
  const tokens = settings.loadTokens();
  if (!tokens) return null;
  const client = makeClient('http://127.0.0.1');
  client.setCredentials(tokens);
  client.on('tokens', (t) => {
    const merged = { ...settings.loadTokens(), ...t };
    settings.saveTokens(merged);
  });
  return client;
}

function hasValidAuth() {
  const t = settings.loadTokens();
  return !!(t && (t.refresh_token || t.access_token));
}

// Opens the system browser, runs the loopback OAuth flow, stores tokens.
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
        settings.saveTokens(tokens);
        finish(resolve, tokens);
      } catch (err) {
        try { res.end('Error: ' + err.message); } catch {}
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

function signOut() { settings.clearTokens(); }

module.exports = { getOAuthClient, hasValidAuth, hasCredentials, startAuthFlow, signOut, SCOPES };
