# ✈️ Airplane Banner

A background macOS/Windows app that flies an airplane towing a banner across your
screen before each Google Calendar meeting — e.g. **"10 MIN → STANDUP WITH DESIGN"** —
so you actually stop forgetting your meetings. Runs locally; nothing is published.

🌐 **[airplanebanner — landing page & demo](https://adelinalipsa.github.io/airplane-banner/)**

![Airplane Banner flying a "10 MIN → STANDUP" banner across the screen](docs/demo.gif)

## Install

**Download (recommended):** grab the latest `.dmg` (macOS) or `.exe` (Windows) from
the [**Releases**](https://github.com/AdelinaLipsa/airplane-banner/releases/latest)
page. On macOS the first launch needs right-click → **Open** (the build isn't
notarized). Windows users get automatic background updates; on macOS, grab the new
`.dmg` when a release lands.

**From source:**

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

- **Accounts:** connect multiple Google accounts and pick exactly which of each
  account's calendars to watch.
- **Reminders:** minutes before each meeting to fly (default `15, 5, 0`). Respects a
  meeting's own reminder times when it sets them; add `[no-fly]` to a title to skip it.
- **When to fly:** restrict to working hours/days, and stay grounded while another app
  is fullscreen or a Focus / Do Not Disturb is on.
- **Which meetings:** skip all-day, skip declined, require attendees/video link, show title.
- **Appearance:** four banner themes (with a live preview), flight speed, and a flight
  chime (pick the sound + volume).
- **Launch at login.**

Tray menu also has **Today**'s remaining meetings, **Test flight**, **Snooze**, **Pause**,
and **Check for updates…**.

## Development

```bash
npm test     # pure-logic unit tests (normalize, filter, scheduler, presence, accounts)
npm run lint # eslint
```

Releases are published by pushing a `v*` tag — CI builds the installers and publishes a
GitHub Release that existing installs auto-update from.

## Notes / limits (v1)

- Primary monitor only.
- Not code-signed: on macOS the first launch may need right-click → Open.
