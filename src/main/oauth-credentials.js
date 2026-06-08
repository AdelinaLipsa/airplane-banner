'use strict';
// ── OAuth client credentials ────────────────────────────────────────────────
// Real values live in the GITIGNORED file `oauth-credentials.local.js` so they
// never reach version control. Copy this template to that file and fill it in:
//
//   module.exports = { clientId: '...', clientSecret: '...' };
//
// Once set, anyone running the app just clicks "Sign in with Google" — no Google
// Cloud setup on their part. See README.md → "One-time Google setup (developer)".
//
// Note: desktop OAuth client secrets are NOT confidential — they ship inside the
// app and can be extracted. This is Google's expected model for installed
// (desktop) apps, and the requested scope here is read-only calendar access.

let local = {};
try {
  // eslint-disable-next-line global-require
  local = require('./oauth-credentials.local');
} catch {
  // No local credentials file — sign-in stays disabled until one is added.
}

module.exports = {
  clientId: local.clientId || '',
  clientSecret: local.clientSecret || '',
};
