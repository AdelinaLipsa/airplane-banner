'use strict';
// ── One-time developer setup ────────────────────────────────────────────────
// Paste the OAuth *Desktop app* client you created in Google Cloud Console here.
// Once these are filled in, anyone running the app just clicks "Sign in with
// Google" — no Google Cloud setup on their part.
//
// See README.md → "One-time Google setup (developer)".
//
// Note: desktop OAuth client secrets are NOT confidential — they ship inside the
// app and can be extracted. This is Google's expected model for installed
// (desktop) apps, and the requested scope here is read-only calendar access.
module.exports = {
  clientId: '280937527000-rfvjcvddhumj97fd5ks0o34o6b51aje2.apps.googleusercontent.com',
  clientSecret: 'REDACTED-SECRET',
};
