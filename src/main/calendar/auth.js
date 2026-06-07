'use strict';
const http = require('http');
const { URL } = require('url');
const { shell } = require('electron');
const { OAuth2Client } = require('google-auth-library');
const settings = require('../settings');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function makeClient(redirectUri) {
  return new OAuth2Client(
    settings.get('oauthClientId'),
    settings.get('oauthClientSecret'),
    redirectUri,
  );
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
    if (!settings.get('oauthClientId') || !settings.get('oauthClientSecret')) {
      reject(new Error('Missing OAuth client id/secret. Add them in Settings.'));
      return;
    }
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
        const code = reqUrl.searchParams.get('code');
        if (!code) { res.end('Waiting for Google…'); return; }
        res.end('<html><body style="font-family:sans-serif">✅ Signed in. You can close this tab.</body></html>');
        server.close();
        const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
        settings.saveTokens(tokens);
        resolve(tokens);
      } catch (err) {
        try { res.end('Error: ' + err.message); } catch {}
        server.close();
        reject(err);
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
    server.on('error', reject);
  });
}

function signOut() { settings.clearTokens(); }

module.exports = { getOAuthClient, hasValidAuth, startAuthFlow, signOut, SCOPES };
