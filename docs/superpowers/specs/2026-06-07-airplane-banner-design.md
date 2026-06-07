# Airplane Banner — Design Spec

**Date:** 2026-06-07
**Status:** Draft for review

## Summary

A cross-platform (macOS + Windows) desktop app that runs quietly in the
background and, ahead of each Google Calendar meeting, flies a little airplane
towing a banner across your screen announcing how long until the meeting (e.g.
"10 MIN → STANDUP WITH DESIGN"). It exists because a single calendar
notification is too easy to dismiss and forget — a plane dragging a banner
across your whole screen is impossible to ignore, and repeating it (e.g. 15 min
→ 5 min → now) makes the meeting actually stick.

**Design north star:** impossible to ignore, without being annoying enough that
you'd quit the app.

Local-only: not published to any store, no code-signing/notarization. Runs on
the user's own machine.

## Goals

- Sync with Google Calendar (read-only) and announce upcoming meetings.
- A delightful, attention-grabbing airplane-banner animation flown as a
  transparent, click-through overlay over everything.
- Configurable, repeating reminders per meeting.
- Lives in the background: menu bar / system tray, auto-launch at login,
  snooze/pause, and a manual test-flight.

## Non-goals (v1)

- Multi-monitor support (primary display only; easy later extension).
- Writing to the calendar / RSVP / event creation (read-only).
- App store distribution, code-signing, auto-update.
- Calendars other than Google (no Outlook/iCloud direct integration).

## Tech stack

**Electron** (chosen over Tauri and native-per-platform). Rationale: directly
reuses the CodePen animation (HTML/CSS/JS), one codebase for macOS + Windows,
and well-trodden paths for transparent click-through overlays, tray menus,
launch-at-login, and the official `googleapis` library for Calendar.

Key libraries:
- `googleapis` + `google-auth-library` — Calendar API + OAuth (loopback flow).
- `electron-store` — persisted settings.
- Electron `safeStorage` — encrypt OAuth tokens at rest (OS keychain-backed).
- `electron` `Tray`, `app.setLoginItemSettings`, `powerMonitor`,
  `BrowserWindow` (transparent / always-on-top / click-through).

## Architecture

A single Electron app with one always-running **main process** and two renderer
surfaces:

- **Main process (Node.js)** — the brain. Owns lifecycle, tray, scheduler,
  calendar polling, OAuth, settings, power/sleep handling.
- **Overlay window** — transparent, frameless, always-on-top, **click-through**
  `BrowserWindow` spanning the primary display. Hosts the plane+banner
  animation. Hidden until a flight is triggered; shows, flies once, hides.
- **Settings window** — a normal small window for Google sign-in, reminder
  timing, and toggles. Opened from the tray.

### Data flow

```
every ~5 min:
  Google Calendar ──> calendar/client ──> calendar/filter ──> scheduler
  scheduler computes fire times for each (event × reminder offset)
  and sets precise timers (deduped against already-fired reminders)

at a fire time (if not paused/snoozed):
  scheduler ──> overlay-window.fly({minutes, title})
  overlay renderer renders banner text into waving segments
  plane flies across once (~8–12s) ──> window hides
```

On each poll the schedule is rebuilt from fresh events; fired reminders are
remembered (by event id + offset) so re-polling never double-fires. On system
resume (`powerMonitor`), the schedule is recomputed so timers don't go stale
after the laptop sleeps.

## Components

Each is a focused, independently-testable unit.

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `calendar/auth.js` | Google OAuth via local loopback redirect; load/refresh/store tokens (encrypted via `safeStorage`) | google-auth-library, settings |
| `calendar/client.js` | Fetch events for the next few hours (`events.list`, `singleEvents=true`, `orderBy=startTime`, `timeMin`/`timeMax`) | auth |
| `calendar/normalize.js` | Map raw Google event JSON → internal `Event` shape | — |
| `calendar/filter.js` | **Pure**: apply the four event filters | — |
| `scheduler.js` | **Pure logic + timers**: compute fire times, dedupe, honor snooze/pause; emit `fly` events | filter, settings, clock |
| `windows/overlay-window.js` | Create/position transparent click-through window; send banner payload | electron |
| `windows/settings-window.js` | Settings UI window lifecycle | electron |
| `renderer/overlay/` | The plane+banner animation; render dynamic text into segments | — |
| `renderer/settings/` | Sign-in + config form | — |
| `tray.js` | Tray menu + state display | settings, scheduler, overlay |
| `settings.js` | Persisted config (`electron-store`) + launch-at-login | electron-store |
| `main.js` | Wire everything together | all |

### Internal `Event` shape

```
{
  id: string,            // Google event id (used for dedupe)
  title: string,         // summary
  start: number,         // epoch ms (timed start)
  isAllDay: boolean,
  responseStatus: string,// 'accepted' | 'declined' | 'needsAction' | 'tentative' | null
  calendarId: string,    // which calendar it came from
  hasAttendees: boolean,
  hasConferenceLink: boolean, // Meet/Zoom/etc.
}
```

## Behavior details

### Reminders (configurable multi-reminder)
- Each meeting can fire **multiple reminders** at configurable offsets before
  start. Default offsets: **[15, 5, 0] minutes**.
- For each qualifying event × each offset, `fireTime = start − offset`.
- Only future, not-already-fired reminders are scheduled. Dedup key:
  `eventId + offset`.
- At 0 minutes the banner reads "NOW → {title}".

### Event filtering (all four enabled by default)
1. **Skip all-day events.**
2. **Skip events the user has declined** (`responseStatus === 'declined'`).
3. **Primary calendar only** (ignore secondary/subscribed calendars).
4. **Require attendees or a conference link** (skip solo time-blocks).

(Implemented as a pure function so each rule is unit-testable and the set is
easy to tweak later.)

### Overlay window
- `transparent: true`, `frame: false`, `alwaysOnTop: true` (screen-saver
  level), `skipTaskbar: true`, `focusable: false`, `hasShadow: false`,
  `resizable: false`.
- `setIgnoreMouseEvents(true)` → fully click-through; never steals focus.
- Sized/positioned to the **primary display** work area.
- macOS: `setVisibleOnAllWorkspaces(true)` so it appears over fullscreen spaces.
- Shown only during a flight; hidden immediately after the animation completes.

### Banner text
- Format: `"{minutes} MIN → {TITLE}"`, or `"NOW → {TITLE}"` at 0 min.
- Meeting **title is shown** (per decision). Known tradeoff: visible during
  screen-share. Noted as a possible future toggle, out of scope for v1.

### Background app
- **Menu bar / system tray icon** with: next meeting summary, **Test flight**,
  **Snooze** (1 hour / until tomorrow), **Pause** (toggle), **Settings…**,
  **Quit**.
- **Auto-launch at login** (on by default; toggle in settings).
- **Test flight** triggers the animation on demand with sample text.

## Visual treatment

Adapted from the reference CodePen "Airplane pulling a banner"
(<https://codepen.io/jensbroecher/pen/wvZQdEa>) for **structure**, with the
**Retro Arcade** palette for **color/style**.

- **Reuse the plane + banner only:** the `#aircraft` sprite, spinning
  `#propeller`, two waving tow-lines (the `::before`/`::after` rope effect), and
  the `#banner` built from rippling `.segment` fabric strips. **Drop** the
  CodePen's sky/clouds/sea scene — our banner flies over a transparent overlay
  on the real desktop.
- **Motion:** plane enters off one screen edge and flies straight across once,
  towing the rippling banner, then exits (replacing the CodePen's bob-in-place
  loop). Duration ~8–12s.
- **Retro Arcade palette (applied to the banner):** chunky yellow fabric
  (`#facc15`), deep indigo pixel/monospace text (`#1e1b4b`), hard pink
  drop-shadow + blocky border (`#f43f5e`); tow-lines and outline in indigo.
- **Dynamic text:** the meeting string is rendered across the waving segments at
  runtime so it ripples like real fabric. The renderer receives
  `{ minutes, title }` over IPC and rebuilds the segmented banner each flight.

## Configuration (persisted via electron-store)

```
{
  reminderOffsetsMinutes: [15, 5, 0],
  filters: {
    skipAllDay: true,
    skipDeclined: true,
    primaryCalendarOnly: true,
    requireAttendeesOrLink: true
  },
  showTitle: true,
  launchAtLogin: true,
  pollIntervalMinutes: 5,
  snoozeUntilEpochMs: null,   // null = not snoozed
  paused: false
}
// OAuth tokens stored separately, encrypted via safeStorage (not in plain store).
```

## Error handling

- **No network / API error** → keep last cached events, retry with backoff;
  tray shows a ⚠ "can't reach calendar" state.
- **Token expired/revoked** → tray + settings prompt re-sign-in.
- **No upcoming meetings** → tray shows "No meetings soon"; no flights.
- **Sleep/wake drift** → recompute schedule on `powerMonitor` resume.
- **Overlay/render failure** → logged; never crashes the background process; the
  tray keeps working.
- **Snooze/pause active at a fire time** → skip that flight (do not queue it for
  later).

## Testing

- **TDD** on the two units carrying the real complexity:
  - `calendar/filter.js` — each filtering rule, with crafted events.
  - `scheduler.js` — offset→fire-time math, dedup, snooze/pause gating — using
    an injected/mock clock.
- `calendar/normalize.js` — against saved sample Google API JSON payloads.
- Manual verification: the **Test flight** button previews the animation; a dev
  helper can inject a "fake meeting in 1 minute" to exercise the full path.

## Project structure

```
airplane-banner/
  package.json
  src/
    main/
      main.js
      tray.js
      scheduler.js
      settings.js
      calendar/
        auth.js
        client.js
        normalize.js
        filter.js
      windows/
        overlay-window.js
        settings-window.js
    renderer/
      overlay/   (index.html, plane.css, plane.js)   ← adapted CodePen
      settings/  (index.html, settings.js)
  test/
    filter.test.js
    scheduler.test.js
    normalize.test.js
```

## Open setup task for the user (one-time)

To use real Google OAuth, the user creates a free Google Cloud project, enables
the Calendar API, and creates an OAuth **Desktop app** client; the client
id/secret are entered into the app's settings on first run. (Desktop client
secrets are not truly secret; the loopback flow is the standard approach for
local desktop apps.) This will be documented in the README.

## Future extensions (out of scope for v1)

- Multi-monitor (fly across the active display, or all displays).
- Title-privacy toggle / auto-hide title when screen-sharing.
- Configurable visual themes (the four palettes explored: Aurora Glass, Sunset
  Pop, Mono Minimal, Retro Arcade).
- Sound effect on flight.
