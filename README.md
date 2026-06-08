# ✈️ Airplane Banner

A background macOS/Windows app that flies an airplane towing a banner across your
screen before each Google Calendar meeting — e.g. **"10 MIN → STANDUP WITH DESIGN"** —
so you actually stop forgetting your meetings. Runs locally; nothing is published.

## Install & run

```bash
npm install
npm start
```

The app runs in the background with a menu-bar / system-tray icon (no dock icon on macOS).

## Signing in (for everyone using the app)

Just open tray → **Settings…** → **Sign in with Google**, approve in the browser,
done. No Google Cloud setup. (On an unverified build you'll see a one-time
"Google hasn't verified this app" screen — click **Advanced → Go to Airplane
Banner**.) Calendar access is **read-only**.

## One-time Google setup (developer / whoever ships the app)

The app talks to Google through a single OAuth client that ships inside it. Create
it once and paste the values into `src/main/oauth-credentials.local.js` (this file
is gitignored so the secret never reaches version control; bundled into builds):

```js
module.exports = { clientId: '…apps.googleusercontent.com', clientSecret: 'GOCSPX-…' };
```

1. Go to <https://console.cloud.google.com/> and create a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → User type **External**.
   - Add the scope `.../auth/calendar.readonly`.
   - While the app is in "Testing", add each user's Google address under
     **Test users** (up to 100). To remove the warning and the 100-user cap,
     submit the consent screen for **verification** (requires a privacy policy
     and Google review).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   application type **Desktop app**.
5. Copy the **Client ID** and **Client secret** into `src/main/oauth-credentials.local.js`.

> Desktop OAuth client secrets are not confidential — they ship inside the app and
> can be extracted. This is Google's expected model for installed desktop apps.
> (A user can still override the embedded client in their own settings store if
> they prefer their own credentials.)

## Configuration (tray → Settings…)

- **Reminders:** minutes before each meeting to fly (default `15, 5, 0`).
- **Which meetings:** skip all-day, skip declined, primary calendar only, require
  attendees/video link, show meeting title.
- **Launch at login.**

Tray menu also has **Test flight**, **Snooze** (1 hour / until tomorrow), and **Pause**.

## Development

```bash
npm test     # runs pure-logic unit tests (normalize, filter, scheduler)
```

## Notes / limits (v1)

- Primary monitor only.
- Not code-signed: on macOS the first launch may need right-click → Open.
