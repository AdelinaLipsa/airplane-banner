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

## One-time Google setup

The app reads your calendar with your own free Google OAuth client:

1. Go to <https://console.cloud.google.com/> and create a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → External → add yourself as a **Test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   application type **Desktop app**.
5. Copy the **Client ID** and **Client secret**.
6. In the app: tray → **Settings…**, paste both, **Save**, then **Sign in with Google**.

> Desktop OAuth client secrets are not truly secret; the loopback sign-in flow used
> here is Google's standard approach for local desktop apps. Calendar access is
> **read-only**.

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
