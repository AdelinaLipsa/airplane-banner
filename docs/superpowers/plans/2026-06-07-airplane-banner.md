# Airplane Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A background macOS/Windows Electron app that flies an airplane-banner overlay across the screen ahead of Google Calendar meetings (e.g. "10 MIN → STANDUP WITH DESIGN").

**Architecture:** One always-running Electron main process owns a tray menu, a calendar poll loop, and a scheduler. Pure, electron-free logic modules (normalize/filter/scheduler) are unit-tested with `node --test`. A transparent, click-through, always-on-top overlay window hosts the plane+banner animation (adapted from the reference CodePen, recolored Retro Arcade). A small settings window handles Google sign-in and config.

**Tech Stack:** Electron, `googleapis` + `google-auth-library` (OAuth loopback, read-only Calendar), `electron-store` (settings), Electron `safeStorage` (encrypted tokens), Node built-in test runner (`node --test`).

**Reference spec:** `docs/superpowers/specs/2026-06-07-airplane-banner-design.md`

**Conventions:** CommonJS (`require`/`module.exports`) everywhere so pure modules run under `node --test` without Electron. Pure modules (`normalize.js`, `filter.js`, `scheduler.js`) MUST NOT import `electron`.

**Internal `Event` shape (used across normalize/filter/scheduler):**
```js
{
  id: string,                 // Google event id (dedupe key)
  title: string,              // summary
  start: number,              // epoch ms of timed start
  isAllDay: boolean,
  responseStatus: string|null,// 'accepted'|'declined'|'needsAction'|'tentative'|null
  calendarId: string,         // 'primary' for the primary calendar
  hasAttendees: boolean,      // at least one attendee who is not self
  hasConferenceLink: boolean  // Meet/Zoom/etc. present
}
```

---

## File Structure

```
airplane-banner/
  package.json
  .gitignore                       (exists)
  src/
    main/
      main.js                      # app entry: wiring, poll loop, powerMonitor
      tray.js                      # tray icon + menu
      settings.js                  # electron-store config + encrypted token storage
      scheduler.js                 # pure reminder math + live timer wrapper
      calendar/
        auth.js                    # OAuth loopback client
        client.js                  # events.list fetch
        normalize.js               # raw Google JSON -> Event   (pure)
        filter.js                  # the four event filters       (pure)
      windows/
        overlay-window.js          # transparent click-through overlay window
        overlay-preload.js         # IPC bridge for overlay renderer
        settings-window.js         # settings window lifecycle
        settings-preload.js        # IPC bridge for settings renderer
    renderer/
      overlay/
        index.html
        plane.css
        plane.js                   # banner text + flight orchestration
      settings/
        index.html
        settings.js
  test/
    normalize.test.js
    filter.test.js
    scheduler.test.js
  assets/
    trayTemplate.png               # tray icon (generated in Task 1)
  README.md
```

---

## Task 1: Project scaffold + runnable Electron app with tray placeholder

**Files:**
- Create: `package.json`
- Create: `src/main/main.js`
- Create: `assets/trayTemplate.png`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "airplane-banner",
  "version": "0.1.0",
  "description": "An airplane flies a banner across your screen before Google Calendar meetings.",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test"
  },
  "license": "MIT",
  "devDependencies": {
    "electron": "^31.0.0"
  },
  "dependencies": {
    "electron-store": "^8.2.0",
    "googleapis": "^140.0.0",
    "google-auth-library": "^9.0.0"
  }
}
```

Note: `electron-store@8` is the last CommonJS-compatible major; do not upgrade to v9+ (ESM-only).

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors. (If Electron download is slow, that's normal.)

- [ ] **Step 3: Generate a simple tray icon**

Run:
```bash
mkdir -p assets && node -e "const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVR42mNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCgA3kwH9cVvU7QAAAABJRU5ErkJggg==','base64'); require('fs').writeFileSync('assets/trayTemplate.png', b);"
```
Expected: `assets/trayTemplate.png` exists (a 16x16 transparent placeholder; replace with real art later).

- [ ] **Step 4: Write minimal `src/main/main.js`**

```js
const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'));
  tray = new Tray(icon);
  tray.setToolTip('Airplane Banner');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Airplane Banner (starting…)', enabled: false },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]));
}

app.whenReady().then(() => {
  createTray();
  if (process.platform === 'darwin') app.dock.hide(); // background app, no dock icon
});

// Keep running with no windows open (background app).
app.on('window-all-closed', (e) => { /* do not quit */ });
```

- [ ] **Step 5: Run the app**

Run: `npm start`
Expected: app launches with no window; a tray/menu-bar icon appears with a "Quit" item. Quit from the menu to stop.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main/main.js assets/trayTemplate.png
git commit -m "feat: scaffold Electron app with background tray"
```

---

## Task 2: Event normalization (pure, TDD)

**Files:**
- Create: `src/main/calendar/normalize.js`
- Test: `test/normalize.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/normalize.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeEvent, normalizeEvents } = require('../src/main/calendar/normalize');

const base = {
  id: 'e1',
  summary: 'Standup',
  start: { dateTime: '2026-06-07T10:00:00Z' },
  attendees: [
    { self: true, responseStatus: 'accepted' },
    { email: 'a@b.com', responseStatus: 'accepted' },
  ],
};

test('normalizes a timed event with attendees', () => {
  const ev = normalizeEvent(base, { calendarId: 'primary' });
  assert.strictEqual(ev.id, 'e1');
  assert.strictEqual(ev.title, 'Standup');
  assert.strictEqual(ev.start, Date.parse('2026-06-07T10:00:00Z'));
  assert.strictEqual(ev.isAllDay, false);
  assert.strictEqual(ev.responseStatus, 'accepted');
  assert.strictEqual(ev.calendarId, 'primary');
  assert.strictEqual(ev.hasAttendees, true);
  assert.strictEqual(ev.hasConferenceLink, false);
});

test('detects all-day events', () => {
  const ev = normalizeEvent({ id: 'e2', summary: 'OOO', start: { date: '2026-06-07' } }, { calendarId: 'primary' });
  assert.strictEqual(ev.isAllDay, true);
});

test('detects conference link via hangoutLink', () => {
  const ev = normalizeEvent({ ...base, hangoutLink: 'https://meet.google.com/xyz' }, { calendarId: 'primary' });
  assert.strictEqual(ev.hasConferenceLink, true);
});

test('hasAttendees is false when only self', () => {
  const ev = normalizeEvent({ ...base, attendees: [{ self: true, responseStatus: 'accepted' }] }, { calendarId: 'primary' });
  assert.strictEqual(ev.hasAttendees, false);
  assert.strictEqual(ev.responseStatus, 'accepted');
});

test('missing summary falls back to "Meeting", missing attendees safe', () => {
  const ev = normalizeEvent({ id: 'e3', start: { dateTime: '2026-06-07T10:00:00Z' } }, { calendarId: 'primary' });
  assert.strictEqual(ev.title, 'Meeting');
  assert.strictEqual(ev.hasAttendees, false);
  assert.strictEqual(ev.responseStatus, null);
});

test('normalizeEvents maps a list and tags calendarId', () => {
  const out = normalizeEvents([base], { calendarId: 'primary' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].calendarId, 'primary');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/normalize.test.js`
Expected: FAIL — `Cannot find module '../src/main/calendar/normalize'`.

- [ ] **Step 3: Write `src/main/calendar/normalize.js`**

```js
'use strict';

function detectConferenceLink(raw) {
  if (raw.hangoutLink) return true;
  if (raw.conferenceData && raw.conferenceData.entryPoints &&
      raw.conferenceData.entryPoints.length > 0) return true;
  const text = `${raw.location || ''} ${raw.description || ''}`.toLowerCase();
  return /meet\.google\.com|zoom\.us|teams\.microsoft\.com|webex\.com/.test(text);
}

function selfResponse(raw) {
  const attendees = raw.attendees || [];
  const me = attendees.find((a) => a.self === true);
  return me ? (me.responseStatus || null) : null;
}

function normalizeEvent(raw, { calendarId }) {
  const isAllDay = !!(raw.start && raw.start.date && !raw.start.dateTime);
  const startStr = raw.start && (raw.start.dateTime || raw.start.date);
  const attendees = raw.attendees || [];
  return {
    id: raw.id,
    title: raw.summary || 'Meeting',
    start: startStr ? Date.parse(startStr) : NaN,
    isAllDay,
    responseStatus: selfResponse(raw),
    calendarId,
    hasAttendees: attendees.some((a) => a.self !== true),
    hasConferenceLink: detectConferenceLink(raw),
  };
}

function normalizeEvents(rawItems, opts) {
  return (rawItems || []).map((raw) => normalizeEvent(raw, opts));
}

module.exports = { normalizeEvent, normalizeEvents };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/normalize.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/calendar/normalize.js test/normalize.test.js
git commit -m "feat: add calendar event normalization"
```

---

## Task 3: Event filtering (pure, TDD)

**Files:**
- Create: `src/main/calendar/filter.js`
- Test: `test/filter.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/filter.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { shouldAnnounce, filterEvents } = require('../src/main/calendar/filter');

const ALL_ON = {
  skipAllDay: true,
  skipDeclined: true,
  primaryCalendarOnly: true,
  requireAttendeesOrLink: true,
};

function ev(overrides) {
  return {
    id: 'e', title: 'M', start: Date.now() + 60000, isAllDay: false,
    responseStatus: 'accepted', calendarId: 'primary',
    hasAttendees: true, hasConferenceLink: false, ...overrides,
  };
}

test('keeps a normal accepted primary meeting with attendees', () => {
  assert.strictEqual(shouldAnnounce(ev(), ALL_ON), true);
});

test('skips all-day events when enabled', () => {
  assert.strictEqual(shouldAnnounce(ev({ isAllDay: true }), ALL_ON), false);
});

test('skips declined events when enabled', () => {
  assert.strictEqual(shouldAnnounce(ev({ responseStatus: 'declined' }), ALL_ON), false);
});

test('skips non-primary calendars when enabled', () => {
  assert.strictEqual(shouldAnnounce(ev({ calendarId: 'other@group' }), ALL_ON), false);
});

test('skips solo blocks (no attendees, no link) when required', () => {
  assert.strictEqual(shouldAnnounce(ev({ hasAttendees: false, hasConferenceLink: false }), ALL_ON), false);
});

test('keeps solo block with a conference link', () => {
  assert.strictEqual(shouldAnnounce(ev({ hasAttendees: false, hasConferenceLink: true }), ALL_ON), true);
});

test('respects disabled filters', () => {
  const NONE = { skipAllDay: false, skipDeclined: false, primaryCalendarOnly: false, requireAttendeesOrLink: false };
  assert.strictEqual(shouldAnnounce(ev({ isAllDay: true, responseStatus: 'declined', hasAttendees: false }), NONE), true);
});

test('filterEvents removes the disqualified ones', () => {
  const list = [ev(), ev({ id: 'x', isAllDay: true })];
  const out = filterEvents(list, ALL_ON);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 'e');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/filter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/calendar/filter.js`**

```js
'use strict';

function shouldAnnounce(event, filters) {
  if (filters.skipAllDay && event.isAllDay) return false;
  if (filters.skipDeclined && event.responseStatus === 'declined') return false;
  if (filters.primaryCalendarOnly && event.calendarId !== 'primary') return false;
  if (filters.requireAttendeesOrLink && !(event.hasAttendees || event.hasConferenceLink)) return false;
  return true;
}

function filterEvents(events, filters) {
  return events.filter((e) => shouldAnnounce(e, filters));
}

module.exports = { shouldAnnounce, filterEvents };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/filter.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/calendar/filter.js test/filter.test.js
git commit -m "feat: add event filtering rules"
```

---

## Task 4: Scheduler pure functions (TDD)

**Files:**
- Create: `src/main/scheduler.js` (pure functions only in this task)
- Test: `test/scheduler.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/scheduler.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { computeReminders, reminderKey, isSuppressed } = require('../src/main/scheduler');

const MIN = 60000;

function ev(id, startOffsetMin, title = 'Standup') {
  return { id, title, start: 1000000 + startOffsetMin * MIN };
}

test('computes one reminder per (event, offset) in the future', () => {
  const now = 1000000;
  const events = [ev('a', 20)]; // starts 20 min from now
  const out = computeReminders(events, [15, 5, 0], now);
  // fire times: start-15 (=+5min, future), start-5 (=+15min), start-0 (=+20min)
  assert.strictEqual(out.length, 3);
  const offsets = out.map((r) => r.offset).sort((x, y) => x - y);
  assert.deepStrictEqual(offsets, [0, 5, 15]);
  const r15 = out.find((r) => r.offset === 15);
  assert.strictEqual(r15.fireAt, ev('a', 20).start - 15 * MIN);
  assert.strictEqual(r15.minutes, 15);
  assert.strictEqual(r15.title, 'Standup');
  assert.strictEqual(r15.eventId, 'a');
});

test('drops reminders whose fire time is already past', () => {
  const now = 1000000;
  const events = [ev('a', 3)]; // starts in 3 min
  const out = computeReminders(events, [15, 5, 0], now);
  // start-15 and start-5 are in the past; only start-0 (+3min) remains
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].offset, 0);
});

test('reminderKey is stable per event+offset', () => {
  assert.strictEqual(reminderKey({ eventId: 'a', offset: 5 }), 'a:5');
});

test('isSuppressed true when paused', () => {
  assert.strictEqual(isSuppressed(1000, { paused: true, snoozeUntilEpochMs: null }), true);
});

test('isSuppressed true when snooze is in the future', () => {
  assert.strictEqual(isSuppressed(1000, { paused: false, snoozeUntilEpochMs: 5000 }), true);
});

test('isSuppressed false when snooze has passed', () => {
  assert.strictEqual(isSuppressed(9000, { paused: false, snoozeUntilEpochMs: 5000 }), false);
});

test('isSuppressed false when not paused and no snooze', () => {
  assert.strictEqual(isSuppressed(1000, { paused: false, snoozeUntilEpochMs: null }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scheduler.test.js`
Expected: FAIL — module not found / exports undefined.

- [ ] **Step 3: Write the pure functions in `src/main/scheduler.js`**

```js
'use strict';

const MIN = 60000;

function computeReminders(events, offsetsMinutes, now) {
  const out = [];
  for (const event of events) {
    for (const offset of offsetsMinutes) {
      const fireAt = event.start - offset * MIN;
      if (fireAt > now) {
        out.push({ eventId: event.id, offset, fireAt, minutes: offset, title: event.title });
      }
    }
  }
  return out;
}

function reminderKey(r) {
  return `${r.eventId}:${r.offset}`;
}

function isSuppressed(now, { paused, snoozeUntilEpochMs }) {
  if (paused) return true;
  if (snoozeUntilEpochMs && snoozeUntilEpochMs > now) return true;
  return false;
}

module.exports = { computeReminders, reminderKey, isSuppressed, MIN };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/scheduler.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all normalize/filter/scheduler tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/scheduler.js test/scheduler.test.js
git commit -m "feat: add scheduler reminder math"
```

---

## Task 5: Live scheduler wrapper (timers + dedupe + suppression)

**Files:**
- Modify: `src/main/scheduler.js` (append `createScheduler`)

This wraps the pure functions with real timers. It is verified manually in later tasks (it depends on wall-clock timers), so no unit test here.

- [ ] **Step 1: Append `createScheduler` to `src/main/scheduler.js`**

Add below the existing `module.exports` line — and update the exports.

```js
// --- Live scheduler -------------------------------------------------------

// Node/Electron setTimeout uses a 32-bit ms delay (~24.8 days). Cap each timer
// and re-arm if the real fire time is further out.
const MAX_DELAY = 2 ** 31 - 1;

function createScheduler({ getState, onFly }) {
  // getState() -> { offsetsMinutes, paused, snoozeUntilEpochMs }
  // onFly({ minutes, title }) -> show the banner
  const timers = new Map();   // key -> Timeout
  const fired = new Set();    // key -> already shown

  function arm(reminder) {
    const key = reminderKey(reminder);
    if (fired.has(key) || timers.has(key)) return;
    const delay = Math.min(reminder.fireAt - Date.now(), MAX_DELAY);
    const t = setTimeout(() => {
      timers.delete(key);
      if (reminder.fireAt - Date.now() > 1000) { arm(reminder); return; } // re-arm long timers
      fired.add(key);
      const state = getState();
      if (isSuppressed(Date.now(), state)) return; // paused/snoozed -> skip, do not requeue
      onFly({ minutes: reminder.minutes, title: reminder.title });
    }, Math.max(delay, 0));
    timers.set(key, t);
  }

  return {
    // Recompute from the latest events; arm any new, not-yet-fired reminders.
    update(events) {
      const { offsetsMinutes } = getState();
      const reminders = computeReminders(events, offsetsMinutes, Date.now());
      for (const r of reminders) arm(r);
    },
    // Fire a sample banner immediately (Test flight).
    testFly() {
      onFly({ minutes: 10, title: 'Standup with Design' });
    },
    // Cancel everything (e.g., on sign-out).
    clear() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      fired.clear();
    },
    _debug: { timers, fired },
  };
}

module.exports.createScheduler = createScheduler;
```

- [ ] **Step 2: Sanity-check it still loads and tests pass**

Run: `npm test`
Expected: PASS (pure tests unaffected; `createScheduler` not yet exercised).

- [ ] **Step 3: Commit**

```bash
git add src/main/scheduler.js
git commit -m "feat: add live scheduler with timers, dedupe, suppression"
```

---

## Task 6: Overlay window + plane/banner animation

**Files:**
- Create: `src/main/windows/overlay-window.js`
- Create: `src/main/windows/overlay-preload.js`
- Create: `src/renderer/overlay/index.html`
- Create: `src/renderer/overlay/plane.css`
- Create: `src/renderer/overlay/plane.js`
- Modify: `src/main/main.js` (temporary test trigger, removed in Task 7)

- [ ] **Step 1: Write `src/renderer/overlay/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="plane.css" />
</head>
<body>
  <div id="flight">
    <div id="banner-wrap"><div id="banner"></div></div>
    <div id="rope"></div>
    <div id="aircraft">
      <svg id="plane-svg" viewBox="0 0 120 70" aria-hidden="true">
        <path d="M2 40 L78 36 L96 18 L104 18 L98 36 L116 35 Q120 36 116 38 L60 46 L40 60 L32 60 L40 46 L14 48 Z" />
      </svg>
      <div id="propeller"></div>
    </div>
  </div>
  <script src="plane.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `src/renderer/overlay/plane.css`** (Retro Arcade palette)

```css
:root {
  --ink: #1e1b4b;     /* deep indigo */
  --gold: #facc15;    /* banner fabric */
  --pop: #f43f5e;     /* hard pink shadow */
}
html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }

#flight {
  position: absolute;
  top: 14vh;
  left: 0;
  display: flex;
  align-items: center;
  transform: translateX(-90vw);
  will-change: transform;
}
#flight.flying { animation: flyAcross var(--dur, 11s) linear forwards; }
@keyframes flyAcross {
  from { transform: translateX(-90vw); }
  to   { transform: translateX(115vw); }
}

#banner-wrap {
  background: var(--gold);
  border: 4px solid var(--ink);
  border-radius: 6px;
  box-shadow: 8px 8px 0 var(--pop);
  padding: 10px 18px;
}
#banner {
  display: flex;
  font-family: ui-monospace, "Courier New", monospace;
  font-weight: 800;
  font-size: 30px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink);
}
.ch { display: inline-block; animation: wave 1.1s ease-in-out infinite; }
@keyframes wave { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

#rope { width: 64px; height: 4px; background: var(--ink); margin: 0 8px; align-self: center; }

#aircraft { position: relative; width: 120px; height: 70px; }
#plane-svg { width: 100%; height: 100%; fill: var(--ink); filter: drop-shadow(5px 5px 0 var(--pop)); }
#propeller {
  position: absolute; right: 2px; top: 14px;
  width: 6px; height: 40px; background: var(--ink);
  transform-origin: center; animation: spin 0.12s linear infinite;
}
@keyframes spin { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.15); } }

@media (prefers-reduced-motion: reduce) {
  .ch, #propeller { animation: none; }
}
```

- [ ] **Step 3: Write `src/renderer/overlay/plane.js`**

```js
const flight = document.getElementById('flight');
const banner = document.getElementById('banner');

function formatText(minutes, title) {
  const t = (title || 'Meeting').toUpperCase();
  return minutes > 0 ? `${minutes} MIN → ${t}` : `NOW → ${t}`;
}

function setBanner(text) {
  banner.innerHTML = '';
  [...text].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c === ' ' ? ' ' : c;
    s.style.animationDelay = (i * 0.05) + 's';
    banner.appendChild(s);
  });
}

function fly(payload) {
  setBanner(formatText(payload.minutes, payload.title));
  flight.classList.remove('flying');
  void flight.offsetWidth; // restart the CSS animation
  flight.classList.add('flying');
}

flight.addEventListener('animationend', (e) => {
  if (e.animationName === 'flyAcross') {
    flight.classList.remove('flying');
    if (window.overlayApi) window.overlayApi.flightDone();
  }
});

if (window.overlayApi) window.overlayApi.onFly(fly);
window.__fly = fly; // manual dev trigger from devtools
```

- [ ] **Step 4: Write `src/main/windows/overlay-preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  onFly: (cb) => ipcRenderer.on('fly', (_e, payload) => cb(payload)),
  flightDone: () => ipcRenderer.send('flight-done'),
});
```

- [ ] **Step 5: Write `src/main/windows/overlay-window.js`**

```js
const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let win = null;

function build() {
  const display = screen.getPrimaryDisplay();
  const b = display.bounds;
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, resizable: false, movable: false,
    minimizable: false, maximizable: false, skipTaskbar: true,
    focusable: false, hasShadow: false, alwaysOnTop: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'overlay', 'index.html'));
  win.on('closed', () => { win = null; });
  return win;
}

function flyBanner(payload) {
  const w = win || build();
  const send = () => { w.showInactive(); w.webContents.send('fly', payload); };
  if (w.webContents.isLoading()) {
    w.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

ipcMain.on('flight-done', () => { if (win) win.hide(); });

module.exports = { flyBanner };
```

- [ ] **Step 6: Add a temporary test trigger to `src/main/main.js`**

Add this require near the top:
```js
const { flyBanner } = require('./windows/overlay-window');
```
And inside `app.whenReady().then(() => { ... })`, after `createTray();`, add:
```js
  // TEMPORARY: fly a sample banner 2s after launch to verify the overlay.
  setTimeout(() => flyBanner({ minutes: 10, title: 'Standup with Design' }), 2000);
```

- [ ] **Step 7: Run and visually verify**

Run: `npm start`
Expected: ~2s after launch, a yellow banner reading "10 MIN → STANDUP WITH DESIGN" with an indigo plane and pink hard-shadow flies across the screen once, then disappears. You can still click through it to apps underneath. On macOS the first run may need screen-recording/accessibility permission only if it doesn't appear over other apps; normal windows do not.

- [ ] **Step 8: Remove the temporary trigger**

Delete the two temporary lines added in Step 6 (the `setTimeout(... flyBanner ...)`), but KEEP the `require('./windows/overlay-window')` import (used in Task 7). Re-run `npm start` to confirm no banner now flies on launch.

- [ ] **Step 9: Commit**

```bash
git add src/main/windows/overlay-window.js src/main/windows/overlay-preload.js src/renderer/overlay/ src/main/main.js
git commit -m "feat: add transparent click-through plane/banner overlay (Retro Arcade)"
```

---

## Task 7: Settings store + tray menu wired to test-flight, snooze, pause

**Files:**
- Create: `src/main/settings.js`
- Create: `src/main/tray.js`
- Modify: `src/main/main.js`

- [ ] **Step 1: Write `src/main/settings.js`**

```js
'use strict';
const Store = require('electron-store');
const { safeStorage } = require('electron');

const DEFAULTS = {
  reminderOffsetsMinutes: [15, 5, 0],
  filters: {
    skipAllDay: true,
    skipDeclined: true,
    primaryCalendarOnly: true,
    requireAttendeesOrLink: true,
  },
  showTitle: true,
  launchAtLogin: true,
  pollIntervalMinutes: 5,
  snoozeUntilEpochMs: null,
  paused: false,
  oauthClientId: '',
  oauthClientSecret: '',
};

const store = new Store({ defaults: DEFAULTS });

function getAll() { return store.store; }
function get(key) { return store.get(key); }
function set(key, value) { store.set(key, value); }

// --- Encrypted OAuth token storage ---------------------------------------
function saveTokens(tokens) {
  const json = JSON.stringify(tokens);
  if (safeStorage.isEncryptionAvailable()) {
    store.set('tokensEnc', safeStorage.encryptString(json).toString('base64'));
    store.delete('tokensPlain');
  } else {
    store.set('tokensPlain', json); // fallback (e.g. Linux without keyring)
  }
}
function loadTokens() {
  const enc = store.get('tokensEnc');
  if (enc && safeStorage.isEncryptionAvailable()) {
    try { return JSON.parse(safeStorage.decryptString(Buffer.from(enc, 'base64'))); }
    catch { return null; }
  }
  const plain = store.get('tokensPlain');
  return plain ? JSON.parse(plain) : null;
}
function clearTokens() { store.delete('tokensEnc'); store.delete('tokensPlain'); }

module.exports = { DEFAULTS, getAll, get, set, saveTokens, loadTokens, clearTokens };
```

- [ ] **Step 2: Write `src/main/tray.js`**

```js
'use strict';
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const settings = require('./settings');

const MIN = 60000;

function createTray({ onTestFlight, onOpenSettings, onQuit, onSnooze, onTogglePause }) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'));
  const tray = new Tray(icon);
  tray.setToolTip('Airplane Banner');

  let statusLine = 'Starting…';

  function build() {
    const paused = settings.get('paused');
    const snoozeUntil = settings.get('snoozeUntilEpochMs');
    const snoozed = snoozeUntil && snoozeUntil > Date.now();
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: statusLine, enabled: false },
      { type: 'separator' },
      { label: 'Test flight', click: onTestFlight },
      {
        label: 'Snooze',
        submenu: [
          { label: 'For 1 hour', click: () => onSnooze(Date.now() + 60 * MIN) },
          { label: 'Until tomorrow', click: () => onSnooze(nextMorning()) },
          ...(snoozed ? [{ label: 'Cancel snooze', click: () => onSnooze(null) }] : []),
        ],
      },
      { label: paused ? 'Resume' : 'Pause', click: onTogglePause },
      { type: 'separator' },
      { label: 'Settings…', click: onOpenSettings },
      { label: 'Quit', click: onQuit },
    ]));
  }

  function nextMorning() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime();
  }

  build();
  return {
    setStatus(line) { statusLine = line; build(); },
    refresh: build,
  };
}

module.exports = { createTray };
```

- [ ] **Step 3: Rewrite `src/main/main.js` to wire tray + scheduler + overlay (no calendar yet)**

```js
const { app } = require('electron');
const settings = require('./settings');
const { createTray } = require('./tray');
const { flyBanner } = require('./windows/overlay-window');
const { createScheduler } = require('./scheduler');

let tray = null;

const scheduler = createScheduler({
  getState: () => ({
    offsetsMinutes: settings.get('reminderOffsetsMinutes'),
    paused: settings.get('paused'),
    snoozeUntilEpochMs: settings.get('snoozeUntilEpochMs'),
  }),
  onFly: (payload) => flyBanner(payload),
});

function openSettings() { /* implemented in Task 10 */ }

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  tray = createTray({
    onTestFlight: () => scheduler.testFly(),
    onOpenSettings: openSettings,
    onQuit: () => app.quit(),
    onSnooze: (until) => { settings.set('snoozeUntilEpochMs', until); tray.refresh(); },
    onTogglePause: () => { settings.set('paused', !settings.get('paused')); tray.refresh(); },
  });
  tray.setStatus('No calendar connected');
});

app.on('window-all-closed', () => { /* background app: stay alive */ });
```

- [ ] **Step 4: Run and verify the tray menu**

Run: `npm start`
Expected: tray menu shows "No calendar connected", **Test flight**, **Snooze** (1 hour / until tomorrow), **Pause/Resume**, **Settings…**, **Quit**. Clicking **Test flight** flies the sample banner. Clicking **Pause** toggles the label to **Resume**.

- [ ] **Step 5: Commit**

```bash
git add src/main/settings.js src/main/tray.js src/main/main.js
git commit -m "feat: add settings store and tray menu (test flight, snooze, pause)"
```

---

## Task 8: Google OAuth (loopback flow)

**Files:**
- Create: `src/main/calendar/auth.js`

This talks to Google and the network; verify manually (Task 11 exercises the full path once the settings window can capture credentials). No unit test.

- [ ] **Step 1: Write `src/main/calendar/auth.js`**

```js
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
```

- [ ] **Step 2: Smoke-check it loads**

Run: `node -e "process.env.DUMMY=1" && node --check src/main/calendar/auth.js`
Expected: no syntax errors (it requires electron at runtime, so don't execute it under plain node — `--check` only parses).

- [ ] **Step 3: Commit**

```bash
git add src/main/calendar/auth.js
git commit -m "feat: add Google OAuth loopback flow"
```

---

## Task 9: Calendar client (events.list)

**Files:**
- Create: `src/main/calendar/client.js`

- [ ] **Step 1: Write `src/main/calendar/client.js`**

```js
'use strict';
const { google } = require('googleapis');

// Fetch upcoming primary-calendar events within the next `hoursAhead` hours.
async function fetchUpcomingEvents(authClient, { hoursAhead = 4 } = {}) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + hoursAhead * 3600000).toISOString();
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });
  return res.data.items || [];
}

module.exports = { fetchUpcomingEvents };
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/main/calendar/client.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/calendar/client.js
git commit -m "feat: add calendar events fetch"
```

---

## Task 10: Settings window (sign-in + config)

**Files:**
- Create: `src/main/windows/settings-window.js`
- Create: `src/main/windows/settings-preload.js`
- Create: `src/renderer/settings/index.html`
- Create: `src/renderer/settings/settings.js`
- Modify: `src/main/main.js` (implement `openSettings`, register IPC)

- [ ] **Step 1: Write `src/main/windows/settings-preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (patch) => ipcRenderer.invoke('settings:save', patch),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  authStatus: () => ipcRenderer.invoke('auth:status'),
});
```

- [ ] **Step 2: Write `src/main/windows/settings-window.js`**

```js
const { BrowserWindow } = require('electron');
const path = require('path');

let win = null;

function openSettingsWindow() {
  if (win) { win.focus(); return win; }
  win = new BrowserWindow({
    width: 520, height: 640, title: 'Airplane Banner — Settings',
    resizable: false, minimizable: true, maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'settings', 'index.html'));
  win.on('closed', () => { win = null; });
  return win;
}

module.exports = { openSettingsWindow };
```

- [ ] **Step 3: Write `src/renderer/settings/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; color: #1e1b4b; }
    h1 { font-size: 18px; }
    fieldset { border: 1px solid #ddd; border-radius: 8px; margin: 14px 0; padding: 12px; }
    legend { font-weight: 600; }
    label { display: block; margin: 8px 0; font-size: 14px; }
    input[type=text], input[type=password] { width: 100%; padding: 6px; box-sizing: border-box; }
    .row { display: flex; align-items: center; gap: 8px; }
    button { background: #1e1b4b; color: #facc15; border: 0; border-radius: 6px;
             padding: 8px 14px; font-weight: 700; cursor: pointer; }
    #status { font-size: 13px; color: #555; }
    .save-bar { position: sticky; bottom: 0; background: #fff; padding-top: 10px; }
  </style>
</head>
<body>
  <h1>✈️ Airplane Banner</h1>

  <fieldset>
    <legend>Google Calendar</legend>
    <p id="status">Checking…</p>
    <label>OAuth Client ID
      <input id="clientId" type="text" placeholder="xxxx.apps.googleusercontent.com" />
    </label>
    <label>OAuth Client Secret
      <input id="clientSecret" type="password" placeholder="GOCSPX-…" />
    </label>
    <div class="row">
      <button id="signIn">Sign in with Google</button>
      <button id="signOut">Sign out</button>
    </div>
  </fieldset>

  <fieldset>
    <legend>Reminders</legend>
    <label>Minutes before each meeting (comma-separated)
      <input id="offsets" type="text" placeholder="15, 5, 0" />
    </label>
  </fieldset>

  <fieldset>
    <legend>Which meetings</legend>
    <label class="row"><input id="skipAllDay" type="checkbox" /> Skip all-day events</label>
    <label class="row"><input id="skipDeclined" type="checkbox" /> Skip events I declined</label>
    <label class="row"><input id="primaryCalendarOnly" type="checkbox" /> Primary calendar only</label>
    <label class="row"><input id="requireAttendeesOrLink" type="checkbox" /> Require attendees or a video link</label>
    <label class="row"><input id="showTitle" type="checkbox" /> Show meeting title on banner</label>
  </fieldset>

  <fieldset>
    <legend>App</legend>
    <label class="row"><input id="launchAtLogin" type="checkbox" /> Launch at login</label>
  </fieldset>

  <div class="save-bar"><button id="save">Save</button> <span id="saved"></span></div>

  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `src/renderer/settings/settings.js`**

```js
const api = window.settingsApi;
const $ = (id) => document.getElementById(id);

async function refreshStatus() {
  const s = await api.authStatus();
  $('status').textContent = s.signedIn
    ? '✅ Connected to Google Calendar'
    : (s.hasCredentials ? 'Not signed in.' : 'Enter your OAuth credentials, then sign in.');
}

async function load() {
  const c = await api.load();
  $('clientId').value = c.oauthClientId || '';
  $('clientSecret').value = c.oauthClientSecret || '';
  $('offsets').value = (c.reminderOffsetsMinutes || []).join(', ');
  $('skipAllDay').checked = c.filters.skipAllDay;
  $('skipDeclined').checked = c.filters.skipDeclined;
  $('primaryCalendarOnly').checked = c.filters.primaryCalendarOnly;
  $('requireAttendeesOrLink').checked = c.filters.requireAttendeesOrLink;
  $('showTitle').checked = c.showTitle;
  $('launchAtLogin').checked = c.launchAtLogin;
  await refreshStatus();
}

function collect() {
  const offsets = $('offsets').value.split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    oauthClientId: $('clientId').value.trim(),
    oauthClientSecret: $('clientSecret').value.trim(),
    reminderOffsetsMinutes: offsets.length ? offsets : [15, 5, 0],
    filters: {
      skipAllDay: $('skipAllDay').checked,
      skipDeclined: $('skipDeclined').checked,
      primaryCalendarOnly: $('primaryCalendarOnly').checked,
      requireAttendeesOrLink: $('requireAttendeesOrLink').checked,
    },
    showTitle: $('showTitle').checked,
    launchAtLogin: $('launchAtLogin').checked,
  };
}

$('save').addEventListener('click', async () => {
  await api.save(collect());
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 1500);
});
$('signIn').addEventListener('click', async () => {
  await api.save(collect());          // persist credentials first
  $('status').textContent = 'Opening browser…';
  try { await api.signIn(); } catch (e) { $('status').textContent = 'Error: ' + e.message; }
  await refreshStatus();
});
$('signOut').addEventListener('click', async () => { await api.signOut(); await refreshStatus(); });

load();
```

- [ ] **Step 5: Wire IPC + `openSettings` + launch-at-login in `src/main/main.js`**

Add near the top requires:
```js
const { ipcMain } = require('electron');
const { openSettingsWindow } = require('./windows/settings-window');
const auth = require('./calendar/auth');
```
Replace the placeholder `function openSettings() {}` with:
```js
function openSettings() { openSettingsWindow(); }

function applyLaunchAtLogin() {
  app.setLoginItemSettings({ openAtLogin: settings.get('launchAtLogin'), openAsHidden: true });
}

ipcMain.handle('settings:load', () => settings.getAll());
ipcMain.handle('settings:save', (_e, patch) => {
  for (const [k, v] of Object.entries(patch)) settings.set(k, v);
  applyLaunchAtLogin();
  if (tray) tray.refresh();
  return settings.getAll();
});
ipcMain.handle('auth:signIn', async () => { await auth.startAuthFlow(); return true; });
ipcMain.handle('auth:signOut', () => { auth.signOut(); scheduler.clear(); return true; });
ipcMain.handle('auth:status', () => ({
  signedIn: auth.hasValidAuth(),
  hasCredentials: !!(settings.get('oauthClientId') && settings.get('oauthClientSecret')),
}));
```
And inside `app.whenReady().then(...)`, after creating the tray, add:
```js
  applyLaunchAtLogin();
```

- [ ] **Step 6: Run and verify settings UI**

Run: `npm start`
Then tray → **Settings…**. Expected: window opens; toggles reflect defaults (all filters checked, offsets "15, 5, 0"). Type any text in the OAuth fields, click **Save** → "Saved ✓". Close and reopen Settings → values persisted.

- [ ] **Step 7: Commit**

```bash
git add src/main/windows/settings-window.js src/main/windows/settings-preload.js src/renderer/settings/ src/main/main.js
git commit -m "feat: add settings window with sign-in and config"
```

---

## Task 11: Poll loop, scheduling, power/sleep, status — full wiring

**Files:**
- Modify: `src/main/main.js`

- [ ] **Step 1: Add the poll loop and power handling to `src/main/main.js`**

Add near the top requires:
```js
const { powerMonitor } = require('electron');
const { fetchUpcomingEvents } = require('./calendar/client');
const { normalizeEvents } = require('./calendar/normalize');
const { filterEvents } = require('./calendar/filter');
```
Add these helpers above `app.whenReady`:
```js
let pollTimer = null;

function nextMeetingLine(events) {
  if (!events.length) return 'No meetings soon';
  const e = events[0];
  const mins = Math.max(0, Math.round((e.start - Date.now()) / 60000));
  return `Next: ${e.title} in ${mins} min`;
}

async function poll() {
  const client = auth.getOAuthClient();
  if (!client) { if (tray) tray.setStatus('Not signed in'); return; }
  try {
    const raw = await fetchUpcomingEvents(client, { hoursAhead: 4 });
    const events = filterEvents(normalizeEvents(raw, { calendarId: 'primary' }), settings.get('filters'))
      .filter((e) => Number.isFinite(e.start))
      .sort((a, b) => a.start - b.start);
    scheduler.update(events);
    if (tray) tray.setStatus(nextMeetingLine(events));
  } catch (err) {
    if (tray) tray.setStatus('⚠ Calendar unavailable');
    console.error('poll failed:', err.message);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  poll();
  pollTimer = setInterval(poll, settings.get('pollIntervalMinutes') * 60000);
}
```
Inside `app.whenReady().then(...)`, after `applyLaunchAtLogin();`, add:
```js
  startPolling();
  powerMonitor.on('resume', () => poll());
```
Update the `auth:signIn` handler to refresh after sign-in:
```js
ipcMain.handle('auth:signIn', async () => { await auth.startAuthFlow(); startPolling(); return true; });
```

- [ ] **Step 2: End-to-end manual verification (real calendar)**

Prereq: complete the Google Cloud setup in Task 12's README. Then:
Run: `npm start` → **Settings…** → paste OAuth Client ID/Secret → **Save** → **Sign in with Google** → approve in browser. Status shows "✅ Connected".
Expected: within ~5 min the tray status updates to "Next: <meeting> in N min". To verify a real flight quickly, create a test event ~2 minutes out with another attendee or a Meet link, set offsets to include `1` and `0`, restart, and watch the plane fly at the 1-minute and start marks.

- [ ] **Step 3: Verify suppression**

With a near-term reminder pending, choose tray → **Pause** (or **Snooze → For 1 hour**) before it fires.
Expected: the banner does NOT fly while paused/snoozed. **Resume** (or cancel snooze) restores flights for future reminders.

- [ ] **Step 4: Commit**

```bash
git add src/main/main.js
git commit -m "feat: wire calendar poll loop, scheduling, and sleep handling"
```

---

## Task 12: README with Google Cloud OAuth setup

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with Google OAuth setup"
```

---

## Task 13: Package distributables (.dmg for macOS, .exe for Windows)

**Files:**
- Modify: `package.json` (add electron-builder config + scripts)

Produces the two double-clickable installers. The macOS `.dmg` is built on a Mac;
the Windows `.exe` is built on Windows (or CI) — cross-building Windows from macOS
is unreliable. Not code-signed (local-only), so first launch shows an
"unidentified developer" warning (macOS: right-click → Open; Windows: More info →
Run anyway).

- [ ] **Step 1: Install electron-builder**

Run: `npm install -D electron-builder`
Expected: added to `devDependencies`, no errors.

- [ ] **Step 2: Add build config + scripts to `package.json`**

Add these three entries to the `"scripts"` block:
```json
    "dist": "electron-builder",
    "dist:mac": "electron-builder --mac",
    "dist:win": "electron-builder --win"
```
And add this top-level `"build"` key:
```json
  "build": {
    "appId": "com.adelina.airplanebanner",
    "productName": "Airplane Banner",
    "files": ["src/**/*", "assets/**/*", "package.json"],
    "mac": {
      "target": "dmg",
      "category": "public.app-category.productivity",
      "extendInfo": { "LSUIElement": 1 }
    },
    "win": {
      "target": "nsis"
    }
  }
```
(`LSUIElement: 1` makes the packaged macOS app a background agent — no dock icon,
matching `app.dock.hide()` in dev.)

- [ ] **Step 3: (Optional) add app icons**

electron-builder auto-uses `build/icon.icns` (macOS) and `build/icon.ico` (Windows)
if present; otherwise it falls back to the default Electron icon. To use a custom
icon later, place those two files under `build/`. Skip for v1.

- [ ] **Step 4: Build the macOS installer (on your Mac)**

Run: `npm run dist:mac`
Expected: `dist/Airplane Banner-0.1.0.dmg` is produced. Open it, drag the app to
Applications, launch (right-click → Open the first time). It should run in the
background with the tray icon.

- [ ] **Step 5: Build the Windows installer (on a Windows machine or CI)**

On Windows: `npm install && npm run dist:win`
Expected: `dist/Airplane Banner Setup 0.1.0.exe`. Running it installs the app;
launch it and confirm the tray icon and Test flight work.
(If you don't have a Windows machine, a GitHub Actions `windows-latest` job running
the same two commands produces the `.exe` as a build artifact.)

- [ ] **Step 6: Confirm `dist/` is ignored by git**

Run: `git status --porcelain dist/ | head`
Expected: no output (the existing `.gitignore` already ignores `dist/`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add electron-builder packaging for macOS and Windows"
```

---

## Task 14: Final full-suite check

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests in `test/` PASS.

- [ ] **Step 2: Launch sanity**

Run: `npm start`
Expected: tray appears; **Test flight** flies the banner; **Settings…** opens; no errors in the terminal.

- [ ] **Step 3: Commit any final touch-ups** (if needed)

```bash
git add -A && git commit -m "chore: final wiring verification"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Electron stack → Task 1. ✅
- Configurable multi-reminder → settings `reminderOffsetsMinutes` (Task 7/10) + `computeReminders` (Task 4). ✅
- Google OAuth (user credentials, loopback, read-only) → Task 8, README Task 12. ✅
- Four event filters → Task 3 (`filter.js`) + settings UI (Task 10). ✅
- Click-through transparent overlay → Task 6. ✅
- Banner = time + title, "NOW" at 0 → `formatText` (Task 6). ✅
- Retro Arcade visual on CodePen-style plane+waving banner → Task 6 (`plane.css`/`plane.js`). ✅
- Tray: next meeting, test flight, snooze, pause, settings, quit → Task 7. ✅
- Auto-launch at login → `applyLaunchAtLogin` (Task 10). ✅
- Poll loop + dedupe + sleep/wake recompute → Tasks 5, 11. ✅
- Suppression on pause/snooze → `isSuppressed` (Task 4) + live scheduler (Task 5) + verify (Task 11). ✅
- Encrypted token storage (`safeStorage`) → Task 7 (`settings.js`). ✅
- Error states (no network, not signed in, no meetings) → Task 11 `poll()` + tray status. ✅
- TDD on filter/scheduler/normalize → Tasks 2–4. ✅
- Project structure → matches File Structure section. ✅
- Distributable installers (.dmg + .exe) via electron-builder → Task 13. ✅

**Placeholder scan:** `openSettings` is intentionally a stub in Task 7 and implemented in Task 10 (noted inline). No other placeholders.

**Type consistency:** `Event` shape consistent across normalize→filter→scheduler. Reminder object (`eventId/offset/fireAt/minutes/title`) consistent between `computeReminders`, `reminderKey`, and `createScheduler`. Settings keys consistent between `settings.js` DEFAULTS, tray, settings UI, and `main.js`. Overlay IPC channel `fly` / `flight-done` consistent between preload, renderer, and window. ✅
