# Windows-only Themed Settings Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Windows, make the entire Settings window adopt the user's selected theme (retro/aurora/sunset/mono) live; leave macOS appearance unchanged.

**Architecture:** Expose `process.platform` to the Settings renderer. On Windows, tag `<html>` with a `win` class and set `body[data-theme]` from the theme dropdown (on load and on change). Four CSS blocks `html.win body[data-theme="X"]` redefine the full surface-variable set with dark, per-theme palettes; their specificity overrides the existing `:root` light/dark rules, which remain the macOS path.

**Tech Stack:** Electron (contextBridge preload), vanilla DOM/CSS. Presentation-only — no automated tests; verified by lint + manual.

Spec: `docs/superpowers/specs/2026-06-09-settings-window-theming-design.md`

---

### Task 1: Expose platform to the Settings renderer

**Files:**
- Modify: `src/main/windows/settings-preload.js`

- [ ] **Step 1: Add `platform` to the bridge**

In `src/main/windows/settings-preload.js`, add a `platform` field to the
`exposeInMainWorld('settingsApi', { ... })` object. Final file:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  platform: process.platform,
  load: () => ipcRenderer.invoke('settings:load'),
  save: (patch) => ipcRenderer.invoke('settings:save', patch),
  testFlight: (appearance) => ipcRenderer.invoke('settings:test-flight', appearance),
  pickCraftFile: () => ipcRenderer.invoke('settings:pick-craft-file'),
  saveCraft: (dataUrl) => ipcRenderer.invoke('settings:save-craft', dataUrl),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  signOutAccount: (id) => ipcRenderer.invoke('auth:signOutAccount', id),
  toggleCalendar: (accountId, calendarId, selected) =>
    ipcRenderer.invoke('accounts:toggleCalendar', { accountId, calendarId, selected }),
  authStatus: () => ipcRenderer.invoke('auth:status'),
});
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/main/windows/settings-preload.js`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/main/windows/settings-preload.js
git commit -m "feat(settings): expose process.platform to the settings renderer"
```

---

### Task 2: Add the four themed surface blocks to the Settings CSS

**Files:**
- Modify: `src/renderer/settings/index.html` (inside the `<style>` block, immediately after the existing `@media (prefers-color-scheme: dark)` rule that ends at the line `    }` closing `:root` — i.e. after line ~23)

- [ ] **Step 1: Insert the themed blocks**

In `src/renderer/settings/index.html`, find the end of this existing block:

```css
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #14132b; --fg: #ece9ff; --muted: #9b97c4;
        --card-bg: #1b1940; --card-border: #2c2a52;
        --field-bg: #221f4a; --field-border: #3a3766;
        --legend: #facc15; --accent: #facc15; --accent-fg: #1e1b4b; --pop: #fb7185;
      }
    }
```

Immediately after it (still inside `<style>`), insert:

```css
    /* Windows-only: the whole window adopts the selected theme. settings.js adds
       `win` to <html> and sets body[data-theme]; these override the :root rules
       above by specificity. macOS keeps the prefers-color-scheme path untouched.
       All four are dark surfaces tinted to the theme, with the theme's signature
       color as the accent. */
    html.win body[data-theme="retro"] {
      --bg: #14132b; --fg: #ece9ff; --muted: #9b97c4;
      --card-bg: #1b1940; --card-border: #2c2a52;
      --field-bg: #221f4a; --field-border: #3a3766;
      --legend: #facc15; --accent: #facc15; --accent-fg: #1e1b4b; --pop: #fb7185;
    }
    html.win body[data-theme="aurora"] {
      --bg: #07101c; --fg: #d7fbf3; --muted: #7fa9a2;
      --card-bg: #0c1a2b; --card-border: #173243;
      --field-bg: #102234; --field-border: #1e3d50;
      --legend: #5eead4; --accent: #5eead4; --accent-fg: #07101c; --pop: #a78bfa;
    }
    html.win body[data-theme="sunset"] {
      --bg: #2a0f1a; --fg: #ffe9ef; --muted: #c98a99;
      --card-bg: #3a1623; --card-border: #52202f;
      --field-bg: #43192a; --field-border: #6b2a3d;
      --legend: #fb7185; --accent: #fb7185; --accent-fg: #2a0f1a; --pop: #f97316;
    }
    html.win body[data-theme="mono"] {
      --bg: #0a0a0a; --fg: #fafafa; --muted: #9ca3af;
      --card-bg: #141414; --card-border: #262626;
      --field-bg: #1a1a1a; --field-border: #333333;
      --legend: #fafafa; --accent: #fafafa; --accent-fg: #0a0a0a; --pop: #9ca3af;
    }
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/renderer/settings/index.html`
Expected: no output. (eslint may ignore `.html`; if so this is a no-op and acceptable — there is no JS in this change.)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/settings/index.html
git commit -m "feat(settings): add per-theme dark surface palettes (Windows)"
```

---

### Task 3: Apply the theme to the window on Windows (load + live)

**Files:**
- Modify: `src/renderer/settings/settings.js` (the `load()` function around line 141, and the existing theme `change` listener around line 248)

- [ ] **Step 1: Add a platform flag and an apply helper**

In `src/renderer/settings/settings.js`, near the top of the file (after the
existing imports/`$` helper, before `load()`), add:

```js
// Windows only: let the whole Settings window wear the selected theme. macOS
// keeps its OS-driven light/dark look (no `win` class → themed CSS never matches).
const IS_WIN = window.settingsApi && window.settingsApi.platform === 'win32';
if (IS_WIN) document.documentElement.classList.add('win');
function applyWindowTheme() {
  if (!IS_WIN) return;
  document.body.dataset.theme = $('theme').value || 'retro';
}
```

- [ ] **Step 2: Call it on load**

In `load()`, find:

```js
  $('theme').value = c.theme || 'retro';
  updateThemePreview();
```

Replace with:

```js
  $('theme').value = c.theme || 'retro';
  updateThemePreview();
  applyWindowTheme();
```

- [ ] **Step 3: Call it live on dropdown change**

Find the existing listener:

```js
$('theme').addEventListener('change', updateThemePreview);
```

Replace with:

```js
$('theme').addEventListener('change', () => { updateThemePreview(); applyWindowTheme(); });
```

- [ ] **Step 4: Lint**

Run: `npx eslint src/renderer/settings/settings.js`
Expected: no output (clean).

- [ ] **Step 5: Run the test suite (no regressions)**

Run: `npm test`
Expected: all tests pass (57 pass at time of writing), 0 fail.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/settings/settings.js
git commit -m "feat(settings): apply selected theme to the window on Windows (live)"
```

---

### Task 4: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: macOS unchanged**

Run the app on macOS (`npm start`), open Settings, toggle the OS between light
and dark. Expected: window still follows OS light/dark; switching the theme
dropdown changes only the banner preview, not the window chrome. No `win` class
on `<html>` (verify in devtools).

- [ ] **Step 2: Windows themed + live (if a Windows machine/VM is available)**

On Windows, open Settings. Switch the theme dropdown through retro → aurora →
sunset → mono. Expected: the whole window (page bg, cards, fields, buttons,
section headers, "saved" text) re-skins instantly to each dark themed palette
and stays readable. Save, reopen Settings — the themed look loads from the saved
theme.

- [ ] **Step 3: Note any readability issues**

If any theme's contrast looks off (text on field, accent button text), adjust
the corresponding `--field-bg`/`--accent-fg` in `index.html` and re-commit. No
code change needed beyond CSS values.

---

## Self-Review

- **Spec coverage:** platform exposure (Task 1) ✓; four full var blocks with the
  spec's exact hex values (Task 2) ✓; `win` class + `body[data-theme]` on load and
  on change, no-op off-Windows (Task 3) ✓; macOS untouched (no `win` class) ✓;
  manual test plan incl. macOS-unchanged + Windows-live (Task 4) ✓. Out-of-scope
  items (preview stage, pill, overlay) correctly left alone.
- **Placeholders:** none — every code step shows full content.
- **Type/name consistency:** `applyWindowTheme`, `IS_WIN`, `win` class, and
  `data-theme` names match across Tasks 2 and 3; hex values match the spec table.
