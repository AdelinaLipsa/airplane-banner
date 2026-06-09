# ✈️ Airplane Banner

A background macOS/Windows app that flies an airplane towing a banner across your
screen before each Google Calendar meeting — e.g. **"10 MIN → STANDUP WITH DESIGN"** —
so you actually stop forgetting your meetings. Swap the plane for a UFO, a dancing
Rick Roll, or your own image. Runs locally; nothing is published.

🌐 **[airplanebanner — landing page & demo](https://adelinalipsa.github.io/airplane-banner/)**

![Airplane Banner flying a "10 MIN → STANDUP" banner across the screen](docs/demo.gif)

## Install

**Download (recommended):** from the
[**Releases**](https://github.com/AdelinaLipsa/airplane-banner/releases/latest) page:

- **macOS** → the **`…-macOS.dmg`** (one universal build — works on both Apple Silicon and Intel).
- **Windows** → the **`…-Windows.exe`**.

The `.zip`, `.yml`, and `.blockmap` files are just for the in-app auto-updater — ignore them.

On macOS the first launch is blocked because the build isn't notarized by Apple
("could not verify… malware"). Right-click the app → **Open** → **Open**, or run:

```bash
xattr -dr com.apple.quarantine "/Applications/Airplane Banner.app"
```

Both platforms auto-update in the background once installed.

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

The Settings window is organized into collapsible sections (click a heading to
minimize it) and follows your system light/dark mode.

- **Accounts:** connect multiple Google accounts and pick exactly which of each
  account's calendars to watch. Give any calendar its own **banner accent color**.
- **Reminders:** minutes before each meeting to fly (default `15, 5, 0`). Respects a
  meeting's own reminder times when it sets them; add `[no-fly]` to a title to skip it.
- **When to fly:** restrict to working hours/days; stay grounded while another app is
  fullscreen or a Focus / Do Not Disturb is on; and choose which screen to fly on
  (the screen under your cursor, or your primary display).
- **Which meetings:** skip all-day, skip declined, require attendees/video link, show title.
- **Appearance:**
  - **Aircraft** — fly the classic TAROM plane, a **UFO**, a **dancing Rick Roll**
    GIF, or **your own image / GIF**. Custom stills have their **background removed
    automatically** (the subject is cut out); animated-GIF cutout is coming.
  - **Banner theme** — four themes with a live preview.
  - **Flight duration** — slide from faster to slower.
  - **Sound** — a synthesized flight chime (fanfare, airport bong, jet flyby,
    Hawaii, marimba, and more) with volume; it plays as the plane enters the screen.
  - **Test flight** — preview the current settings instantly, no need to Save.
- **Menu-bar countdown:** show the time until your next meeting next to the icon
  (macOS); paused shows ⏸ and snoozed shows 💤.
- **Launch at login.**

Tray menu also has **Today**'s remaining meetings, **Test flight**, **Snooze**, **Pause**,
and **Check for updates…**.

## Development

```bash
npm test            # pure-logic unit tests (normalize, filter, scheduler, presence, accounts)
npm run lint        # eslint
npm run build:isolate  # bundle the subject-isolation module (runs automatically on npm start / dist)
```

`npm start` and the packaging scripts auto-run `build:isolate`, which esbuild-bundles
the background-removal module (`src/renderer/settings/isolate.src.js`) — the app's one
build step. The ML model is fetched from a CDN on first use and cached, so it isn't
bundled into the installer.

Releases are published by pushing a `v*` tag — CI builds the installers and publishes a
GitHub Release that existing installs auto-update from. The repo includes a `/release`
helper command that bumps the version, tags, pushes, and waits for the build.

## Notes / limits

- Not code-signed / notarized: on macOS the first launch needs right-click → **Open**
  (or the `xattr` command above).
- Subject isolation (background removal) currently handles **static** custom images;
  animated GIFs fly with their original background until the per-frame cutout lands.
- The menu-bar countdown text is macOS-only (the Windows tray shows just the icon).
